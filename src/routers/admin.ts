import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, ownerOnlyProcedure, publicProcedure } from "../_core/trpc.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq, desc, and, gte, count, sql } from "drizzle-orm";
import { ENV } from "../_core/env.js";
import { createHash, randomBytes } from "crypto";
import { logger } from "../_core/logger.js";

// ── Helpers ──
function hashCode(raw: string): string {
  return createHash("sha256").update(raw + ENV.cookieSecret).digest("hex");
}

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp + ENV.cookieSecret).digest("hex");
}

// ── Real Twilio SMS ──
async function sendSms(phone: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const sid = ENV.twilioAccountSid;
  const token = ENV.twilioAuthToken;
  const from = ENV.twilioPhoneNumber;

  if (!sid || !token || !from) {
    logger.warn({ phone }, "sms_not_sent_no_twilio_credentials");
    return { success: false, error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER not configured" };
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: phone, Body: message }).toString(),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown");
      logger.error({ status: res.status, body, phone }, "twilio_sms_failed");
      return { success: false, error: `Twilio HTTP ${res.status}: ${body}` };
    }

    const data = await res.json();
    logger.info({ phone, sid: data.sid }, "twilio_sms_sent");
    return { success: true, sid: data.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ phone, error: msg }, "twilio_sms_exception");
    return { success: false, error: msg };
  }
}

export const adminRouter = router({
  // ── Identity ──
  me: ownerOnlyProcedure.query(async ({ ctx }) => {
    return { email: ctx.user.email, isOwner: true };
  }),

  // ── Analytics Dashboard ──
  analytics: ownerOnlyProcedure.query(async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalUsers = await db.select({ count: count() }).from(schema.users);
    const activeUsers = await db
      .select({ count: count() })
      .from(schema.users)
      .where(gte(schema.users.updatedAt, thirtyDaysAgo));
    const totalProjects = await db.select({ count: count() }).from(schema.projects);
    const totalBuilds = await db
      .select({ count: count() })
      .from(schema.projects)
      .where(and(
        gte(schema.projects.createdAt, thirtyDaysAgo),
        eq(schema.projects.status, "completed")
      ));
    const totalRevenue = await db
      .select({ total: sql`COALESCE(SUM(${schema.creditTransactions.amount}), 0)` })
      .from(schema.creditTransactions)
      .where(eq(schema.creditTransactions.type, "purchase"));

    const subsByTier = await db
      .select({ tier: schema.subscriptions.tier, count: count() })
      .from(schema.subscriptions)
      .groupBy(schema.subscriptions.tier);

    const recentUsers = await db
      .select()
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(20);

    const bannedUsers = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.isBanned, true));

    return {
      counts: {
        totalUsers: totalUsers[0]?.count ?? 0,
        activeUsers30d: activeUsers[0]?.count ?? 0,
        totalProjects: totalProjects[0]?.count ?? 0,
        builds30d: totalBuilds[0]?.count ?? 0,
        totalRevenue: totalRevenue[0]?.total ?? 0,
      },
      subscriptionsByTier: subsByTier,
      recentUsers: recentUsers.map(u => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt })),
      bannedUsers: bannedUsers.map(u => ({ id: u.id, email: u.email, name: u.name, bannedAt: u.bannedAt, banReason: u.banReason })),
    };
  }),

  // ── God Code ──
  listGodCodes: ownerOnlyProcedure.query(async () => {
    const codes = await db.select().from(schema.godCodes).orderBy(desc(schema.godCodes.createdAt));
    return codes.map(c => ({
      id: c.id,
      tier: c.tier,
      credits: c.credits,
      trialDays: c.trialDays,
      isUsed: c.isUsed,
      usedByUserId: c.usedByUserId,
      usedAt: c.usedAt,
      createdAt: c.createdAt,
    }));
  }),

  createGodCodeInit: ownerOnlyProcedure
    .input(z.object({
      tier: z.enum(["starter", "builder", "studio", "enterprise", "custom", "admin"]),
      credits: z.number().min(0).optional(),
      trialDays: z.number().min(0).optional(),
    }))
    .mutation(async ({ input }) => {
      const rawCode = "GF-" + randomBytes(12).toString("base64url").toUpperCase().slice(0, 16);
      const codeHash = hashCode(rawCode);

      const otp = randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      const [code] = await db.insert(schema.godCodes).values({
        codeHash,
        tier: input.tier,
        credits: input.credits ?? 0,
        trialDays: input.trialDays ?? 0,
        isUsed: true, // locked until SMS verified
      }).returning();

      await db.insert(schema.smsVerifications).values({
        codeId: code.id,
        phoneNumber: ENV.ownerPhone,
        otpHash,
        expiresAt,
      });

      const smsResult = await sendSms(ENV.ownerPhone, `AppForge god code verification: ${otp} (expires in 10 min)`);

      if (!smsResult.success) {
        await db.delete(schema.godCodes).where(eq(schema.godCodes.id, code.id));
        await db.delete(schema.smsVerifications).where(eq(schema.smsVerifications.codeId, code.id));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "SMS service unavailable. Code not created." });
      }

      await db.insert(schema.complianceRecords).values({
        recordType: "god_code_audit",
        userId: null,
        details: { action: "create_init", tier: input.tier, codeId: code.id },
        adminEmail: ENV.ownerEmail,
      });

      return { rawCode, message: "Enter the OTP sent to your phone to activate this god code." };
    }),

  verifyGodCode: ownerOnlyProcedure
    .input(z.object({ rawCode: z.string(), otp: z.string().length(6) }))
    .mutation(async ({ input }) => {
      const codeHash = hashCode(input.rawCode);
      const otpHash = hashOtp(input.otp);

      const code = await db.select().from(schema.godCodes).where(eq(schema.godCodes.codeHash, codeHash)).limit(1);
      if (!code[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Code not found" });

      const verification = await db
        .select()
        .from(schema.smsVerifications)
        .where(and(
          eq(schema.smsVerifications.codeId, code[0].id),
          eq(schema.smsVerifications.otpHash, otpHash),
        ))
        .limit(1);

      if (!verification[0]) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid OTP" });
      if (new Date() > new Date(verification[0].expiresAt)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP expired" });
      }

      await db
        .update(schema.godCodes)
        .set({ isUsed: false, updatedAt: new Date() })
        .where(eq(schema.godCodes.id, code[0].id));

      await db
        .update(schema.smsVerifications)
        .set({ verifiedAt: new Date() })
        .where(eq(schema.smsVerifications.id, verification[0].id));

      await db.insert(schema.complianceRecords).values({
        recordType: "god_code_audit",
        userId: null,
        details: { action: "verify_activate", codeId: code[0].id },
        adminEmail: ENV.ownerEmail,
      });

      return { success: true, message: "God code activated. Give the raw code to a user to redeem." };
    }),

  revokeGodCode: ownerOnlyProcedure
    .input(z.object({ codeId: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(schema.godCodes).where(eq(schema.godCodes.id, input.codeId));
      await db.insert(schema.complianceRecords).values({
        recordType: "god_code_audit",
        userId: null,
        details: { action: "revoke", codeId: input.codeId },
        adminEmail: ENV.ownerEmail,
      });
      return { success: true };
    }),

  // ── User Management ──
  banUser: ownerOnlyProcedure
    .input(z.object({ userId: z.number(), reason: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .update(schema.users)
        .set({ isBanned: true, bannedAt: new Date(), banReason: input.reason })
        .where(eq(schema.users.id, input.userId));
      await db.insert(schema.complianceRecords).values({
        recordType: "security_incident",
        userId: input.userId,
        details: { action: "ban", reason: input.reason },
        adminEmail: ENV.ownerEmail,
      });
      return { success: true };
    }),

  unbanUser: ownerOnlyProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await db
        .update(schema.users)
        .set({ isBanned: false, bannedAt: null, banReason: null })
        .where(eq(schema.users.id, input.userId));
      return { success: true };
    }),

  userStrikes: ownerOnlyProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const strikes = await db
        .select()
        .from(schema.userStrikes)
        .where(eq(schema.userStrikes.userId, input.userId))
        .orderBy(desc(schema.userStrikes.createdAt));
      return strikes;
    }),

  // ── Moderation ──
  moderationQueue: ownerOnlyProcedure.query(async () => {
    const flags = await db
      .select()
      .from(schema.moderationFlags)
      .where(eq(schema.moderationFlags.adminReviewed, false))
      .orderBy(desc(schema.moderationFlags.createdAt));
    return flags;
  }),

  reviewFlag: ownerOnlyProcedure
    .input(z.object({ flagId: z.number(), action: z.enum(["warn", "strike", "ban", "dismiss"]) }))
    .mutation(async ({ input }) => {
      await db
        .update(schema.moderationFlags)
        .set({ adminReviewed: true, adminAction: input.action })
        .where(eq(schema.moderationFlags.id, input.flagId));
      return { success: true };
    }),

  // ── Compliance Export ──
  complianceExport: ownerOnlyProcedure.query(async () => {
    const records = await db
      .select()
      .from(schema.complianceRecords)
      .orderBy(desc(schema.complianceRecords.createdAt));

    const vantaData = {
      exportDate: new Date().toISOString(),
      generatedBy: ENV.ownerEmail,
      system: "AppForge",
      sections: {
        userAccess: records.filter(r => r.recordType === "user_data_access"),
        contentModeration: records.filter(r => r.recordType === "content_moderation"),
        payments: records.filter(r => r.recordType === "payment_audit"),
        security: records.filter(r => r.recordType === "security_incident"),
        godCodes: records.filter(r => r.recordType === "god_code_audit"),
      },
      summary: {
        totalRecords: records.length,
        users: await db.select({ count: count() }).from(schema.users),
        banned: await db.select({ count: count() }).from(schema.users).where(eq(schema.users.isBanned, true)),
        flags: await db.select({ count: count() }).from(schema.moderationFlags),
        activeSubs: await db.select({ count: count() }).from(schema.subscriptions).where(eq(schema.subscriptions.status, "active")),
      },
    };
    return vantaData;
  }),

  // ── Redeem (called by regular users, not admin) ──
  redeem: publicProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Login required to redeem god code" });

      const codeHash = hashCode(input.code);
      const code = await db.select().from(schema.godCodes).where(eq(schema.godCodes.codeHash, codeHash)).limit(1);
      if (!code[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Code not found" });
      if (code[0].isUsed) throw new TRPCError({ code: "FORBIDDEN", message: "Code already used" });

      // Apply tier upgrade
      await db
        .update(schema.subscriptions)
        .set({
          tier: code[0].tier,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptions.userId, ctx.user.id));

      await db
        .update(schema.userCredits)
        .set({
          tier: code[0].tier,
          balance: code[0].credits,
          updatedAt: new Date(),
        })
        .where(eq(schema.userCredits.userId, ctx.user.id));

      await db
        .update(schema.godCodes)
        .set({
          isUsed: true,
          usedByUserId: ctx.user.id,
          usedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.godCodes.id, code[0].id));

      await db.insert(schema.complianceRecords).values({
        recordType: "god_code_audit",
        userId: ctx.user.id,
        details: { action: "redeem", codeId: code[0].id, tier: code[0].tier },
        adminEmail: ENV.ownerEmail,
      });

      logger.info({ userId: ctx.user.id, codeId: code[0].id, tier: code[0].tier }, "god_code_redeemed");
      return { success: true, tier: code[0].tier, credits: code[0].credits };
    }),
});

export type AdminRouter = typeof adminRouter;