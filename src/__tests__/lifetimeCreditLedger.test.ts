import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("God Code credit ledger invariant", () => {
  it("bypasses deductions only for an active owner-issued unlimited God Code", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/db.ts"), "utf8");
    expect(source).toContain("getActiveGodCodeEntitlement(userId)");
    expect(source).toContain("if (godCodeEntitlement.unlimited)");
    expect(source).not.toContain(
      'if (credits.unlimited || credits.tier === "lifetime")',
    );
  });
});
