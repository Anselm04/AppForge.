import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("production build/session continuity release contract", () => {
  it("requires ten reauthentication cycles on the same active build and a second independent build", () => {
      const canary = source("../../scripts/production-customer-canary.mjs");
      const workflow = source(
        "../../.github/workflows/production-full-customer-journey.yml",
      );
      const browser = source(
        "../../scripts/production-canary-browser.spec.mjs",
      );

      expect(canary).toContain("for (let cycle = 1; cycle <= 10; cycle += 1)");
      expect(canary).toContain("supabaseLogout(config, accessToken)");
      expect(canary).toContain(
        "re-authenticated session did not recover the same project",
      );
      expect(canary).toContain(
      "sameBuildRecoveredAfterReauthentication: true",
    );
      expect(canary).toContain("APPFORGE_CANARY_SECONDARY_HCAPTCHA_TOKEN");
      expect(canary).toContain("Production Secondary Canary");
      expect(canary).toContain("Second independent build verified");
      expect(canary).toContain("secondaryIndependentBuildVerified");

      expect(workflow).toContain("secondary_hcaptcha_token");
      expect(workflow).toContain("APPFORGE_CANARY_SECONDARY_HCAPTCHA_TOKEN");

      expect(browser).toContain(
        "secondary independent production build is interactive and isolated",
      );
      expect(browser).toContain("Secondary Canary Button");
  });
});
