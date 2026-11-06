import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { balanceAfterMonthlyGrant } from "../lib/creditRollover.js";

function grantSource() {
  const db = readFileSync(resolve(process.cwd(), "src/db.ts"), "utf8");
  return db.slice(
    db.indexOf("export async function applyGodCodeGrant("),
    db.indexOf("// ── SUBSCRIPTIONS ──"),
  );
}

describe("owner-code grant safety — no external services", () => {
  it("locks and rereads credit balance inside the transaction", () => {
    const s = grantSource();
    const txStart = s.indexOf("const result = await db.transaction");
    const lock = s.indexOf("pg_advisory_xact_lock", txStart);
    const freshRead = s.indexOf(".from(schema.userCredits)", lock);
    const update = s.indexOf(".update(schema.userCredits)", freshRead);
    expect(txStart).toBeGreaterThan(0);
    expect(lock).toBeGreaterThan(txStart);
    expect(freshRead).toBeGreaterThan(lock);
    expect(update).toBeGreaterThan(freshRead);
    expect(s).not.toContain("const row = await getUserCredits(userId)");
  });

  it("checks lifetime access against the user identity within the transaction", () => {
    const s = grantSource();
    expect(s).toContain("const user = await tx.query.users.findFirst");
    expect(s).toContain("if (!isOwnerEmail(user?.email))");
    expect(s).toContain("if (!row.unlimited || row.tier !== \"lifetime\")");
    expect(s).toContain('description: "Lifetime unlimited credits (god code)"');
  });

  it("rejects unsafe amounts and retains existing purchased credits", () => {
    const s = grantSource();
    expect(s).toContain("Number.isSafeInteger(credits)");
    expect(s).toContain("Number.isSafeInteger(userId)");
    expect(s).toContain("balanceAfterMonthlyGrant(row.balance, credits)");
    expect(balanceAfterMonthlyGrant(23, 50)).toBe(73);
    expect(() => balanceAfterMonthlyGrant(Number.MAX_SAFE_INTEGER, 1)).toThrow();
  });
});
