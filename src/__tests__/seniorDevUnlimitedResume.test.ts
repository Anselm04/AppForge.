import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/routes/build.ts"),
  "utf8",
);

describe("Senior Dev unlimited resume entitlement", () => {
  it("exempts unlimited and lifetime users from the resume balance gate", () => {
    expect(source).toContain(
      '!!resumeCredits.unlimited || resumeCredits.tier === "lifetime"',
    );
    expect(source).toContain(
      "if (!resumeUnlimited && resumeCredits.balance < 1)",
    );
  });
});
