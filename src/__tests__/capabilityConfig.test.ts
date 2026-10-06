import { describe, expect, it } from "vitest";
import { resolveCapabilityConfig } from "../capabilities/config.js";

describe("capability provider configuration", () => {
  it("keeps core AppForge available when the broker and Composio are disabled", () => {
    const config = resolveCapabilityConfig({});
    expect(config.brokerEnabled).toBe(false);
    expect(config.composioEnabled).toBe(false);
    expect(config.composioConfigured).toBe(false);
  });

  it("requires the broker and server key before Composio is configured", () => {
    expect(
      resolveCapabilityConfig({ COMPOSIO_ENABLED: "true" }).composioConfigured,
    ).toBe(false);
    expect(
      resolveCapabilityConfig({
        CAPABILITY_BROKER_ENABLED: "true",
        COMPOSIO_ENABLED: "true",
        COMPOSIO_API_KEY: "server-only-key",
      }).composioConfigured,
    ).toBe(true);
  });

  it("rejects invalid boolean flags", () => {
    expect(() =>
      resolveCapabilityConfig({ COMPOSIO_ENABLED: "maybe" }),
    ).toThrow(/COMPOSIO_ENABLED/);
  });
});
