import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("quick edit shares factory validation policy", () => {
  const quick = readFileSync("src/services/quickEditAgent.ts", "utf8");
  const validation = readFileSync(
    "src/lib/buildValidationHelpers.ts",
    "utf8",
  );

  it("never overrides full-stack generated tests to nonblocking", () => {
    expect(quick).toContain("validateProjectFiles(files, techStack)");
    expect(quick).not.toContain("testsBlocking: false");
    expect(validation).toContain(
      'const testsBlocking = options?.testsBlocking ?? mode === "full";',
    );
  });

  it("does not present structural-only checks as runtime certification", () => {
    expect(quick).toContain('outcome.validation.stage === "structure"');
    expect(quick).toContain(
      "Structural source checks passed; native runtime and build remain unverified.",
    );
  });
});
