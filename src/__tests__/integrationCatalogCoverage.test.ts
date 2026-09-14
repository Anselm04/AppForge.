import { describe, expect, it } from "vitest";
import {
  APPFORGE_INTEGRATIONS,
  getIntegrationDefinition,
} from "../integrations/catalog.js";

describe("AppForge integration registry", () => {
  it("keeps every integration id unique", () => {
    const ids = APPFORGE_INTEGRATIONS.map((integration) => integration.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers the production service stack used by AppForge", () => {
    const ids = APPFORGE_INTEGRATIONS.map((integration) => integration.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "supabase",
        "stripe",
        "twilio",
        "github",
        "sprites-fly",
        "vercel",
        "posthog",
        "datadog",
        "sentry",
        "make",
        "bubblav",
        "openai-platform",
      ]),
    );
  });

  it("keeps Twilio verification capabilities explicit", () => {
    const twilio = getIntegrationDefinition("twilio");
    expect(twilio).toBeDefined();
    expect(twilio?.capabilities).toEqual(
      expect.arrayContaining(["verify", "otp", "2fa"]),
    );
    expect(twilio?.env).toContain("TWILIO_VERIFY_SERVICE_SID");
  });
});
