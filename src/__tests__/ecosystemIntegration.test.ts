import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { APPFORGE_INTEGRATIONS } from "../integrations/catalog.js";
import { signEcosystemPayload } from "../services/marketingBridge.js";

describe("AppForge ecosystem integration contract", () => {
  it("registers every requested AppForge integration exactly once", () => {
    const expected = [
      "bubblav",
      "make",
      "sprites-fly",
      "sprites",
      "datadog",
      "deep-research",
      "documents",
      "default-templates",
      "pdf",
      "plugin-management",
      "posthog",
      "presentations",
      "security",
      "spreadsheets",
      "stripe",
      "supabase",
      "template-creator",
      "twilio",
      "vercel",
      "github",
      "sentry",
      "cloudflare",
      "codex-security",
      "marketing-app",
      "trillionaitech-site",
    ];

    const ids = APPFORGE_INTEGRATIONS.map((integration) => integration.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids).toEqual(expect.arrayContaining(expected));
  });

  it("signs ecosystem payloads using timestamped HMAC-SHA256", () => {
    const secret = "test-secret";
    const timestamp = "1760000000000";
    const body = JSON.stringify({ source: "appforge", sourceProjectId: 42 });
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(signEcosystemPayload(secret, timestamp, body)).toBe(expected);
  });

  it("marks revenue-critical platform dependencies as production requirements", () => {
    const required = new Set(
      APPFORGE_INTEGRATIONS.filter(
        (integration) => integration.requiredForProduction,
      ).map((integration) => integration.id),
    );

    for (const id of [
      "stripe",
      "supabase",
      "github",
      "sprites-fly",
      "default-templates",
      "plugin-management",
      "security",
      "marketing-app",
      "trillionaitech-site",
    ]) {
      expect(required.has(id)).toBe(true);
    }
  });
});
