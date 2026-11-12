import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("local load harness safety contract", () => {
  it("executes the real Node safety tests without external requests", () => {
    const output = execFileSync(
      process.execPath,
      ["--test", "scripts/__tests__/load-test-local.test.mjs"],
      {
        encoding: "utf8",
        timeout: 10000,
      },
    );
    expect(output).toContain("pass 2");
    expect(output).not.toContain("fail 1");
  });
});
