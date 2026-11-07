import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production customer generation", () => {
  it("does not substitute imitation source for a failed real build", () => {
    const parts = [0, 1, 2, 3, 4].map((part) =>
      readFileSync("src/agents/.pipeline_parts/part" + part + ".txt", "utf8"),
    );
    const source = parts.join("\n");
    expect(source).not.toContain("buildGuaranteedGreenApp(");
    expect(source).not.toContain("ALLOW_GUARANTEED_GREEN");
    expect(source).toContain("Build failed validation after");
  });
});
