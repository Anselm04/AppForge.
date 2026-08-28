import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq, count, desc } from "drizzle-orm";
import { logger } from "../_core/logger.js";
import { mlModerateContent } from "../lib/mlModeration.js";

const FORBIDDEN_PATTERNS = [
  /\b(child\s*porn|cp|underage|pedo|loli|shota)\b/i,
  /\b(terrorism|bomb\s*making|how\s*to\s*kill|murder\s*guide)\b/i,
  /\b(drug\s*dealing|meth\s*cook|fentanyl\s*lab)\b/i,
  /\b(rape\s*plan|sexual\s*assault\s*guide|non\s*consensual)\b/i,
  /\b(hate\s*speech|genocide|ethnic\s*cleansing|nazi)\b/i,
  /\b(weapon\s*of\s*mass\s*destruction|bioweapon|chemical\s*weapon)\b/i,
];

function checkModeration(text: string): { flagged: boolean; category: string; matched: string } | null {
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let category = "other";
      const lower = match[0].toLowerCase();
      if (lower.includes("porn") || lower.includes("underage") || lower.includes("rape") || lower.includes("sexual")) category = "sexual";
      else if (lower.includes("bomb") || lower.includes("kill") || lower.includes("murder") || lower.includes("weapon") || lower.includes("terror")) category = "dangerous";
      else if (lower.includes("drug") || lower.includes("meth") || lower.includes("fentanyl")) category = "illegal";
      return { flagged: true, category, matched: match[0] };
    }
  }
  return null;
}

export async function moderateUserContent(userId: number, text: string, projectId?: number): Promise<{ allowed: boolean; reason?: string }> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (user?.isBanned) {
    logger.warn({ userId }, "banned_user_attempted_build");
    return { allowed: false, reason: "Your account has been permanently banned." };
  }
  const ml = await mlModerateContent(text);
  if (ml && !ml.allowed) {
    const category = ml.category ?? "other";
    await db.insert(schema.moderationFlags).values({ userId, projectId: projectId ?? null, flaggedText: text.slice(0, 500), category, autoFlagged: true });
    return { allowed: false, reason: ml.reason ?? `Content flagged by ML moderation (${category}).` };
  }
  const result = checkModeration(text);
  if (result) {
    await db.insert(schema.moderationFlags).values({ userId, projectId: projectId ?? null, flaggedText: text.slice(0, 500), category: result.category, autoFlagged: true });
    const existingStrikes = await db.select({ count: count() }).from(schema.userStrikes).where(eq(schema.userStrikes.userId, userId));
    const strikeCount = (existingStrikes[0]?.count ?? 0) + 1;
    await db.insert(schema.userStrikes).values({ userId, strikeNumber: strikeCount, reason: `Auto-flagged: ${result.category} — "${result.matched}"`, contentSnapshot: text.slice(0, 500) });
    logger.warn({ userId, category: result.category, strike: strikeCount }, "content_moderation_strike");
    if (strikeCount >= 3) {
      await db.update(schema.users).set({ isBanned: true, bannedAt: new Date(), banReason: `3 strikes: ${result.category}` }).where(eq(schema.users.id, userId));
      await db.insert(schema.complianceRecords).values({ recordType: "security_incident", userId, details: { action: "auto_ban_3_strikes", category: result.category, text: text.slice(0, 200) }, adminEmail: process.env.OWNER_EMAIL ?? "anselm.perkins@gmail.com" });
      return { allowed: false, reason: "Your account has been permanently banned after 3 content violations." };
    }
    return { allowed: false, reason: `Content flagged (${result.category}). This is strike ${strikeCount} of 3. After 3 strikes your account will be permanently banned.` };
  }
  return { allowed: true };
}

export const moderationRouter = router({
  check: protectedProcedure.input(z.object({ text: z.string().max(2000) })).query(async ({ ctx, input }) => moderateUserContent(ctx.user.id, input.text)),
  appeal: protectedProcedure.input(z.object({ flagId: z.number().int().positive(), message: z.string().min(20).max(2000) })).mutation(async ({ ctx, input }) => {
    const flag = await db.query.moderationFlags.findFirst({ where: eq(schema.moderationFlags.id, input.flagId) });
    if (!flag || flag.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Flag not found" });
    await db.insert(schema.complianceRecords).values({ recordType: "content_moderation", userId: ctx.user.id, details: { action: "appeal", flagId: input.flagId, message: input.message.slice(0, 2000), category: flag.category }, adminEmail: process.env.OWNER_EMAIL ?? "anselm.perkins@gmail.com" });
    return { submitted: true };
  }),
  myFlags: protectedProcedure.query(async ({ ctx }) => db.select().from(schema.moderationFlags).where(eq(schema.moderationFlags.userId, ctx.user.id)).orderBy(desc(schema.moderationFlags.createdAt)).limit(20)),
});

export type ModerationRouter = typeof moderationRouter;
