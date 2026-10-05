import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("capability security observability", () => {
  it("records bounded provider security metrics without customer labels", () => {
    const watchdog = source("src/capabilities/watchdog.ts");
    expect(watchdog).toContain("appforge_capability_security_incidents_total");
    expect(watchdog).toContain("appforge_capability_provider_state");
    expect(watchdog).not.toContain('customerId: signal.context.customerId');
  });

  it("defines operational alerts for provider quarantine and disable", () => {
    const alerts = source("monitoring/alerts.yml");
    expect(alerts).toContain("CapabilityProviderContained");
    expect(alerts).toContain("appforge_capability_provider_state");
  });
});
