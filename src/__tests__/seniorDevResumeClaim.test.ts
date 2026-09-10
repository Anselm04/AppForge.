import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/services/senior-dev-claim.ts"),
  "utf8",
);

describe("Senior Dev resume claim", () => {
  it("atomically transitions only awaiting approval tasks to executing", () => {
    expect(source).toContain("claimSeniorDevResume");
    expect(source).toContain(
      'eq(schema.seniorDevTasks.status, "awaiting_approval")',
    );
    expect(source).toContain('status: "executing"');
    expect(source).toContain("return claimed.length === 1");
  });
});
