import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("LLM provider retry accounting", () => {
  it("fails closed when retry usage evidence cannot be persisted", () => {
    const source = readFileSync("src/_core/llm.ts", "utf8");
    expect(source).toContain("class RetryUsageEvidenceError extends Error");
    expect(source).toContain("if (error instanceof RetryUsageEvidenceError) throw error;");
    expect(source).not.toContain("LLM retry usage evidence unavailable");
    expect(source.match(/throw new RetryUsageEvidenceError\(evidenceError\)/g)).toHaveLength(2);
  });
});
