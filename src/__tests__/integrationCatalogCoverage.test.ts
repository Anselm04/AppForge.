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
        "mcp",
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

  it("registers MCP interoperability as an internal agent capability", () => {
    const mcp = getIntegrationDefinition("mcp");
    expect(mcp).toBeDefined();
    expect(mcp?.kind).toBe("internal");
    expect(mcp?.capabilities).toEqual(
      expect.arrayContaining([
        "mcp",
        "agent-tools",
        "interoperability",
        "tool-discovery",
      ]),
    );
  });

  it("maps deep research to the search providers used by the Planner", () => {
    const research = getIntegrationDefinition("deep-research");
    expect(research?.env).toEqual(
      expect.arrayContaining(["TAVILY_API_KEY", "SERPAPI_API_KEY"]),
    );
    expect(research?.env).not.toContain("OPENAI_API_KEY");
  });

  it("maps Supabase to the runtime-supported URL and publishable-key aliases", () => {
    const supabase = getIntegrationDefinition("supabase");
    expect(supabase?.env).toEqual(
      expect.arrayContaining([
        "SUPABASE_URL",
        "VITE_SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "VITE_SUPABASE_ANON_KEY",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
      ]),
    );
  });

  it("includes Fly deployment credentials in the Sprites/Fly production entry", () => {
    const fly = getIntegrationDefinition("sprites-fly");
    expect(fly?.env).toContain("FLY_API_TOKEN");
  });
});
