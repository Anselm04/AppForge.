import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("generated application runtime evidence", () => {
  const validator = readFileSync("src/agents/buildValidator.ts", "utf8");

  it("does not treat package metadata as evidence of a running application", () => {
    expect(validator).not.toContain("if (shouldRunVite || hasPackageJson)");
    expect(validator).toContain("if (!shouldRunVite) {");
    expect(validator).toContain('stage: "structure"');
    expect(validator).toContain(
      "no supported executable runtime was started",
    );
    expect(validator).toContain("const runtime = await verifyViteRuntime(tmpDir)");
  });
});
