import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { balanceAfterMonthlyGrant } from "../lib/creditRollover.js";

describe("AppForge monthly credits and paid top-ups", () => {
  it("adds monthly credits without removing any separately purchased balance", () => {
    expect(balanceAfterMonthlyGrant(80, 100)).toBe(180);
    expect(balanceAfterMonthlyGrant(0, 100)).toBe(100);
    expect(balanceAfterMonthlyGrant(25, 0)).toBe(25);
  });

  it("rejects invalid, negative or unsafe credit balances", () => {
    for (const [balance, allowance] of [
      [-1, 100],
      [0, -1],
      [Number.MAX_SAFE_INTEGER, 1],
      [Number.NaN, 1],
      [4.5, 1],
    ]) {
      expect(() => balanceAfterMonthlyGrant(balance, allowance)).toThrow(
        /Invalid monthly credit grant/,
      );
    }
  });

  it("keeps new Free Explore accounts free of provider-funded credits", () => {
    const db = readFileSync(resolve(process.cwd(), "src/db.ts"), "utf8");
    const initial = db.slice(
      db.indexOf("export async function ensureUserCredits("),
      db.indexOf("export async function refillMonthlyCredits("),
    );
    expect(initial).toContain("balance: 0,");
    expect(initial).toContain('tier: "free"');
    expect(db).toMatch(/free:\s*0,\s*starter:\s*100/);
    expect(db).toMatch(/TIER_BUILD_LIMITS[^]*?free:\s*0,/);
  });

  it("does not mint monthly credits from a cached tier without verified billing", () => {
    const db = readFileSync(resolve(process.cwd(), "src/db.ts"), "utf8");
    const start = db.indexOf("export async function refillMonthlyCredits(");
    const end = db.indexOf("export async function syncTierFromSubscription(", start);
    const body = db.slice(start, end);
    expect(body).toContain(".from(schema.subscriptions)");
    expect(body).toContain('subscription?.status !== "active"');
    expect(body).toContain('subscription?.status !== "trialing"');
    expect(body).toContain("!subscription?.currentPeriodEnd");
    expect(body).toContain("Number.isFinite(new Date(subscription.currentPeriodEnd).getTime())");
    expect(body).toContain("if (tier && tier !== effectiveTier) return");
    expect(body.indexOf(".from(schema.subscriptions)")).toBeLessThan(
      body.indexOf("balanceAfterMonthlyGrant(credits.balance, refillAmount)"),
    );
  });

  it("uses additive rollover in the actual database refill path", () => {
    const db = readFileSync(resolve(process.cwd(), "src/db.ts"), "utf8");
    const start = db.indexOf("export async function refillMonthlyCredits(");
    const end = db.indexOf("export async function syncTierFromSubscription(", start);
    const body = db.slice(start, end);
    expect(body).toContain(
      "balanceAfterMonthlyGrant(credits.balance, refillAmount)",
    );
    expect(body).not.toContain("balance: refillAmount,");
  });
});
