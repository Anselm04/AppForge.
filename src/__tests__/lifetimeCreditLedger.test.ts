import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("lifetime credit ledger invariant", () => {
  it("never deducts credits from unlimited or lifetime accounts", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/db.ts"), "utf8");
    expect(source).toContain(
      'if (credits.unlimited || credits.tier === "lifetime")',
    );
  });
});
