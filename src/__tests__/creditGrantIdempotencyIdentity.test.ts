import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const db = readFileSync("src/db.ts", "utf8");
const addCredits = db.slice(
  db.indexOf("export async function addCredits("),
  db.indexOf("export async function unpauseCreditExhaustedProjects("),
);

describe("credit grant idempotency identity", () => {
  it("compares the original ledger owner, amount and transaction type", () => {
    expect(addCredits).toContain("userId: schema.creditTransactions.userId");
    expect(addCredits).toContain("amount: schema.creditTransactions.amount");
    expect(addCredits).toContain("type: schema.creditTransactions.type");
    expect(addCredits).toContain("prior[0].userId !== userId");
    expect(addCredits).toContain("prior[0].amount !== amount");
    expect(addCredits).toContain("prior[0].type !== type");
  });

  it("rejects conflicting keys before treating a credit grant as completed", () => {
    const reject = addCredits.indexOf(
      'throw new Error("Conflicting credit transaction idempotency key")',
    );
    const skip = addCredits.indexOf("skipped: true");
    expect(reject).toBeGreaterThan(0);
    expect(skip).toBeGreaterThan(reject);
  });
});
