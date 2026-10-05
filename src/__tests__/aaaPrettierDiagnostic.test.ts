import { describe, it } from "vitest";
import { execFileSync } from "node:child_process";

const files = [
  "src/__tests__/capabilityConfig.test.ts",
  "src/__tests__/capabilityObservability.test.ts",
  "src/__tests__/capabilityPolicy.test.ts",
  "src/capabilities/broker.ts",
  "src/capabilities/config.ts",
  "src/capabilities/policy.ts",
  "src/capabilities/redaction.ts",
  "src/capabilities/types.ts",
  "src/capabilities/watchdog.ts",
  "src/components/CapabilitySecurityBanner.tsx",
];

describe("temporary Prettier diagnostic", () => {
  it("prints the exact repository formatter diff", () => {
    execFileSync("npx", ["prettier", "--write", ...files], {
      stdio: "pipe",
      encoding: "utf8",
    });
    const diff = execFileSync("git", ["diff", "--", ...files], {
      encoding: "utf8",
    });
    console.log("APPFORGE_PRETTIER_DIFF_START\n" + diff + "\nAPPFORGE_PRETTIER_DIFF_END");
  });
});
