import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("provider usage evidence persistence", () => {
  it("fails closed on all provider result paths", () => {
    const source = readFileSync("src/_core/llm.ts", "utf8");
    expect(source).toContain(
      "class ProviderUsagePersistenceError extends Error",
    );
    expect(source).toContain(
      "if (err instanceof ProviderUsagePersistenceError) throw err;",
    );
    expect(
      source.match(/throw new ProviderUsagePersistenceError\(meteringError\);/g),
    ).toHaveLength(4);
    expect(source).not.toContain(
      "Per-build provider usage evidence unavailable",
    );
    expect(source).not.toContain("Network provider usage evidence unavailable");
  });
});
