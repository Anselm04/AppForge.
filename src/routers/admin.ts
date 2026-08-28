import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  ownerOnlyProcedure,
  protectedProcedure,
} from "../_core/trpc.js";
import { applyGodCodeGrant, db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq, desc, and, gte, count, sql, isNull } from "drizzle-orm";
import { ENV } from "../_core/env.js";
import { logger } from "../_core/logger.js";
import {
  encryptGodCode,
  hashGodCode,
  mintGodCode,
} from "../lib/serverSecrets.js";
import { createHash } from "crypto";
import {
  generateOtp,
  hashOtp,
  isTwilioConfigured,
  sendSms,
} from "../lib/twilioSms.js";

const REDEEM_FAIL = "Unable to redeem that code.";

function legacyHash(raw: string): string {
  return createHash("sha256")
    .update(raw + ENV.cookieSecret)
    .digest("hex");
}

function genericRedeemFail(): never {
  throw new TRPCError({ code: "BAD_REQUEST", message: REDEEM_FAIL });
}

export const adminRouter = router({
  me: ownerOnlyProcedure.query(async ({ ctx }) => {
    return { email: ctx.user.email, isOwner: true };
  }),

  analytics: ownerOnlyProcedure.query(async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalUsers = await db.select({ count: count() }).from(schema.users);
    const recentSignups = await db
      .select({ count: count() })
      .from(schema.users)
      .where(gte(schema.users.createdAt, sevenDaysAgo));
    const totalProjects = await db
      .select({ count: count() })
      .from(schema.projects);
    const buildsStarted = await db
      .select({ count: count() })
      .from(schema.projects);
    const builds30d = await db
      .select({ count: count() })
      .from(schema.projects)
      .where(gte(schema.projects.createdAt, thirtyDaysAgo));
    const activeSubs = await db
      .select({ count: count() })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, "active"));
    const creditSum = await db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.userCredits.balance}), 0)`,
      })
      .from(schema.userCredits);

    const subsByTier = await db
      .select({
        tier: schema.subscriptions.tier,
        status: schema.subscriptions.status,
        count: count(),
      })
      .from(schema.subscriptions)
      .groupBy(schema.subscriptions.tier, schema.subscriptions.status);

    const recentUsers = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        createdAt: schema.users.createdAt,
        credits: schema.userCredits.balance,
        unlimited: schema.userCredits.unlimited,
        creditTier: schema.userCredits.tier,
        subTier: schema.subscriptions.tier,
        subStatus: schema.subscriptions.status,
      })
      .from(schema.users)
      .leftJoin(
        schema.userCredits,
        eq(schema.userCredits.userId, schema.users.id),
      )
      .leftJoin(
        schema.subscriptions,
        eq(schema.subscriptions.userId, schema.users.id),
      )
      .orderBy(desc(schema.users.createdAt))
      .limit(50);

    const buildCounts = await db
      .select({ userId: schema.projects.userId, builds: count() })
      .from(schema.projects)
      .groupBy(schema.projects.userId);
    const buildsByUser = new Map(
      buildCounts.map((row) => [row.userId, row.builds]),
    );

    return {
      counts: {
        totalUsers: totalUsers[0]?.count ?? 0,
        recentSignups7d: recentSignups[0]?.count ?? 0,
        totalProjects: totalProjects[0]?.count ?? 0,
        buildsStarted: buildsStarted[0]?.count ?? 0,
        builds30d: builds30d[0]?.count ?? 0,
        activeSubscriptions: activeSubs[0]?.count ?? 0,
        creditBalanceSum: Number(creditSum[0]?.total ?? 0),
      },
      subscriptionsByTier: subsByTier,
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        credits: u.credits ?? 0,
        unlimited: !!u.unlimited,
        tier: u.creditTier ?? "free",
        subscriptionTier: u.subTier ?? null,
        subscriptionStatus: u.subStatus ?? null,
        buildsStarted: buildsByUser.get(u.id) ?? 0,
      })),
    };
  }),

  listUsers: ownerOnlyProcedure.query(async () => {
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        createdAt: schema.users.createdAt,
        credits: schema.userCredits.balance,
        unlimited: schema.userCredits.unlimited,
        tier: schema.userCredits.tier,
        subTier: schema.subscriptions.tier,
        subStatus: schema.subscriptions.status,
      })
      .from(schema.users)
      .leftJoin(
        schema.userCredits,
        eq(schema.userCredits.userId, schema.users.id),
      )
      .leftJoin(
        schema.subscriptions,
        eq(schema.subscriptions.userId, schema.users.id),
      )
      .orderBy(desc(schema.users.createdAt))
      .limit(200);
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
      credits: u.credits ?? 0,
      unlimited: !!u.unlimited,
      tier: u.tier ?? "free",
      subscriptionTier: u.subTier ?? null,
      subscriptionStatus: u.subStatus ?? null,
    }));
  }),

  listCodes: ownerOnlyProcedure.query(async () => {
    const codes = await db
      .select()
      .from(schema.godCodes)
      .orderBy(desc(schema.godCodes.createdAt));
    return codes.map((c) => {
      const redeemedAt = c.redeemedAt ?? c.usedAt ?? null;
      const redeemedBy = c.redeemedByUserId ?? c.usedByUserId ?? null;
      const unused = !redeemedAt && !c.isUsed;
      return {
        id: c.id,
        grantType:
          c.grantType ?? (c.tier === "lifetime" ? "lifetime" : "limited"),
        credits: c.credits ?? 0,
        status: unused ? "unused" : "redeemed",
        expiresAt: c.expiresAt ?? null,
        createdAt: c.createdAt,
        redeemedAt,
        redeemedByUserId: redeemedBy,
      };
    });
  }),

  createCode: ownerOnlyProcedure
    .input(
      z.object({
        grantType: z.enum(["lifetime", "limited"]),
        credits: z.number().int().min(0).max(1_000_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const credits = input.grantType === "lifetime" ? 0 : (input.credits ?? 0);
      if (input.grantType === "limited" && credits < 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Limited codes need a credit amount.",
        });
      }
      const rawCode = mintGodCode();
      const hash = hashGodCode(rawCode);
      const encryptedCode = encryptGodCode(rawCode);
      const [row] = await db
        .insert(schema.godCodes)
        .values({
          hash,
          encryptedCode,
          grantType: input.grantType,
          credits,
          codeHash: hash,
          tier: input.grantType === "lifetime" ? "lifetime" : "custom",
          isUsed: false,
        })
        .returning({
          id: schema.godCodes.id,
          createdAt: schema.godCodes.createdAt,
        });

      await db.insert(schema.complianceRecords).values({
        recordType: "god_code_audit",
        userId: ctx.user.id,
        details: {
          action: "create",
          codeId: row.id,
          grantType: input.grantType,
          credits,
        },
        adminEmail: ctx.user.email,
      });
      logger.info(
        { codeId: row.id, grantType: input.grantType },
        "god_code_created",
      );
      return {
        id: row.id,
        code: rawCode,
        grantType: input.grantType,
        credits,
        createdAt: row.createdAt,
      };
    }),

  redeemCode: protectedProcedure
    .input(
      z.object({
        code: z.string().min(4).max(80),
        phone: z.string().min(8).max(50).optional(),
        otp: z.string().length(6).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const raw = input.code.trim();
      if (!raw) genericRedeemFail();
      let hash: string;
      try {
        hash = hashGodCode(raw);
      } catch {
        genericRedeemFail();
      }
      const legacy = legacyHash(raw);
      const matches = await db
        .select()
        .from(schema.godCodes)
        .where(
          sql`${schema.godCodes.hash} = ${hash} OR ${schema.godCodes.codeHash} = ${hash} OR ${schema.godCodes.codeHash} = ${legacy}`,
        )
        .limit(1);
      const found = matches[0];
      if (!found) genericRedeemFail();
      if (
        found.redeemedAt ||
        found.isUsed ||
        found.redeemedByUserId ||
        found.usedByUserId
      ) {
        genericRedeemFail();
      }
      if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
        genericRedeemFail();
      }

      if (isTwilioConfigured()) {
        if (!input.phone?.trim() || !input.otp?.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Phone number and SMS code are required to redeem this code.",
          });
        }
        const phone = input.phone.trim();
        const otpHash = hashOtp(input.otp.trim());
        const rows = await db
          .select()
          .from(schema.smsVerifications)
          .where(
            and(
              eq(schema.smsVerifications.codeId, found.id),
              eq(schema.smsVerifications.phoneNumber, phone),
              eq(schema.smsVerifications.otpHash, otpHash),
              isNull(schema.smsVerifications.verifiedAt),
            ),
          )
          .limit(1);
        const verification = rows[0];
        if (!verification || new Date(verification.expiresAt) < new Date()) {
          genericRedeemFail();
        }
        await db
          .update(schema.smsVerifications)
          .set({ verifiedAt: new Date() })
          .where(eq(schema.smsVerifications.id, verification.id));
      }

      const now = new Date();
      const updated = await db
        .update(schema.godCodes)
        .set({
          encryptedCode: null,
          redeemedAt: now,
          redeemedByUserId: ctx.user.id,
          isUsed: true,
          usedAt: now,
          usedByUserId: ctx.user.id,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.godCodes.id, found.id),
            isNull(schema.godCodes.redeemedAt),
            eq(schema.godCodes.isUsed, false),
          ),
        )
        .returning({ id: schema.godCodes.id });
      if (!updated[0]) genericRedeemFail();

      const grantType = found.grantType === "lifetime" ? "lifetime" : "limited";
      const grant = await applyGodCodeGrant(
        ctx.user.id,
        grantType,
        found.credits ?? 0,
      );

      await db.insert(schema.complianceRecords).values({
        recordType: "god_code_audit",
        userId: ctx.user.id,
        details: { action: "redeem", codeId: found.id, grantType },
        adminEmail: ENV.ownerEmail,
      });
      logger.info(
        { userId: ctx.user.id, codeId: found.id, grantType },
        "god_code_redeemed",
      );
      return {
        success: true,
        grantType,
        credits: grant.credits,
        unlimited: grant.unlimited,
      };
    }),

  requestRedeemOtp: protectedProcedure
    .input(
      z.object({
        code: z.string().min(4).max(80),
        phone: z.string().min(8).max(50),
      }),
    )
    .mutation(async ({ input }) => {
      if (!isTwilioConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "SMS verification is not enabled on this server.",
        });
      }

      const raw = input.code.trim();
      let hash: string;
      try {
        hash = hashGodCode(raw);
      } catch {
        genericRedeemFail();
      }
      const legacy = legacyHash(raw);
      const matches = await db
        .select()
        .from(schema.godCodes)
        .where(
          sql`${schema.godCodes.hash} = ${hash} OR ${schema.godCodes.codeHash} = ${hash} OR ${schema.godCodes.codeHash} = ${legacy}`,
        )
        .limit(1);
      const found = matches[0];
      if (!found || found.redeemedAt || found.isUsed) genericRedeemFail();

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await db.insert(schema.smsVerifications).values({
        codeId: found.id,
        phoneNumber: input.phone.trim(),
        otpHash: hashOtp(otp),
        expiresAt,
      });

      await sendSms(
        input.phone.trim(),
        `Your AppForge redemption code is ${otp}. It expires in 10 minutes.`,
      );

      return { sent: true, expiresAt: expiresAt.toISOString() };
    }),

  banUser: ownerOnlyProcedure
    .input(z.object({ userId: z.number(), reason: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .update(schema.users)
        .set({ isBanned: true, bannedAt: new Date(), banReason: input.reason })
        .where(eq(schema.users.id, input.userId));
      return { success: true };
    }),

  moderationQueue: ownerOnlyProcedure.query(async () => {
    return db
      .select()
      .from(schema.moderationFlags)
      .where(eq(schema.moderationFlags.adminReviewed, false))
      .orderBy(desc(schema.moderationFlags.createdAt));
  }),
});

export type AdminRouter = typeof adminRouter;
