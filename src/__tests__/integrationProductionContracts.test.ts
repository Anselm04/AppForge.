import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getTeamIntegrationStatus } from "../config/teamIntegrations.js";
import { APPFORGE_INTEGRATIONS } from "../integrations/catalog.js";

const repoRoot = process.cwd();
const preflight = readFileSync(
  join(repoRoot, "scripts/production-integration-preflight.mjs"),
  "utf8",
);
const ecosystemRouter = readFileSync(
  join(repoRoot, "src/routers/ecosystem.ts"),
  "utf8",
);
const runtime = readFileSync(
  join(repoRoot, "src/integrations/runtime.ts"),
  "utf8",
);
const teamIntegrationSource = readFileSync(
  join(repoRoot, "src/config/teamIntegrations.ts"),
  "utf8",
);

const originalEnv = { ...process.env };

function requiredFor(id: string) {
  return APPFORGE_INTEGRATIONS.find((item) => item.id === id)
    ?.requiredForProduction;
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

describe("production plugin and integration contracts", () => {
  it("uses the catalog health flag as the production preflight authority", () => {
    expect(preflight).toContain("entry?.requiredForProduction === true");
    expect(preflight).not.toContain("REQUIRED_RUNTIME_INTEGRATIONS");
    expect(preflight).toContain(
      'item.state !== "connected" || !item.verified',
    );
  });

  it("keeps the expected production-critical integration set explicit in the catalog", () => {
    const requiredIds = APPFORGE_INTEGRATIONS.filter(
      (integration) => integration.requiredForProduction,
    ).map((integration) => integration.id);

    expect(requiredIds).toEqual(
      expect.arrayContaining([
        "sprites-fly",
        "default-templates",
        "plugin-management",
        "security",
        "stripe",
        "supabase",
        "github",
        "marketing-app",
        "trillionaitech-site",
      ]),
    );
  });

  it("keeps external plugin actions behind authenticated procedures and ownership checks", () => {
    expect(ecosystemRouter).toContain("runAutomation: protectedProcedure");
    expect(ecosystemRouter).toContain("runAgentTask: protectedProcedure");
    expect(ecosystemRouter).toContain("runSecurityReview: protectedProcedure");
    expect(ecosystemRouter).toContain("supportMessage: protectedProcedure");
    expect(ecosystemRouter).toContain("project.userId !== ctx.user.id");
    expect(ecosystemRouter).toContain("guardOutboundPayload");
  });

  it("keeps runtime network boundaries fail-closed", () => {
    expect(runtime).toContain("Production integration endpoints must use HTTPS");
    expect(runtime).toContain("Integration endpoints may not embed credentials");
    expect(runtime).toContain('redirect: "manual"');
    expect(runtime).toContain("MAX_INTEGRATION_REQUEST_BYTES");
    expect(runtime).toContain("MAX_INTEGRATION_RESPONSE_BYTES");
  });

  it("keeps real runtime implementations for the requested plugin stack", () => {
    expect(runtime).toContain("export async function runMakeWorkflow");
    expect(runtime).toContain("export async function sendBubblaVSupportMessage");
    expect(runtime).toContain("export async function capturePostHogEvent");
    expect(runtime).toContain("export async function sendDatadogLog");
    expect(runtime).toContain("export async function runSpritesAgentTask");
    expect(runtime).toContain("export async function runCodexSecurityReview");
  });

  it("does not reintroduce stale AI or BubblaV environment assumptions", () => {
    expect(teamIntegrationSource).not.toContain("ANTHROPIC_API_KEY");
    expect(teamIntegrationSource).not.toContain("BUBBLAV_WIDGET_ID");
    expect(teamIntegrationSource).toContain("hasConfiguredLlmProvider");
    expect(teamIntegrationSource).toContain("BUBBLAV_CHAT_URL");
  });

  it("uses the canonical catalog for mapped production requirement flags", () => {
    const mapped = new Map(
      getTeamIntegrationStatus().map((integration) => [
        integration.key,
        integration.requiredForProduction,
      ]),
    );

    expect(mapped.get("github")).toBe(requiredFor("github"));
    expect(mapped.get("make")).toBe(requiredFor("make"));
    expect(mapped.get("bubblav")).toBe(requiredFor("bubblav"));
    expect(mapped.get("posthog-eu")).toBe(requiredFor("posthog"));
    expect(mapped.get("datadog-us1")).toBe(requiredFor("datadog"));
  });
});
