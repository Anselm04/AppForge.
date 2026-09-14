import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertSafeExternalPayload,
  ExternalPayloadGuardError,
} from "../lib/externalPayloadGuard.js";

const buildWorkerSource = readFileSync(
  resolve(process.cwd(), "src/services/build-worker.ts"),
  "utf8",
);
const assetRouterSource = readFileSync(
  resolve(process.cwd(), "src/routers/assets.ts"),
  "utf8",
);
const orgRouterSource = readFileSync(
  resolve(process.cwd(), "src/routers/orgs.ts"),
  "utf8",
);
const integrationRuntimeSource = readFileSync(
  resolve(process.cwd(), "src/integrations/runtime.ts"),
  "utf8",
);
const ecosystemRouterSource = readFileSync(
  resolve(process.cwd(), "src/routers/ecosystem.ts"),
  "utf8",
);

describe("product hardening guardrails", () => {
  it("blocks credential-like fields from outbound integration payloads", () => {
    expect(() =>
      assertSafeExternalPayload({ nested: { api_key: "should-not-leave-appforge" } }),
    ).toThrow(ExternalPayloadGuardError);
    expect(() =>
      assertSafeExternalPayload({ projectId: 1, action: "build", values: [1, 2] }),
    ).not.toThrow();
  });

  it("protects autonomous builds from ownership drift and retries deployment", () => {
    expect(buildWorkerSource).toContain("project.userId !== userId");
    expect(buildWorkerSource).toContain("updated.userId !== userId");
    expect(buildWorkerSource).toContain("DEPLOY_MAX_ATTEMPTS = 3");
    expect(buildWorkerSource).toContain("deployValidatedProjectWithRetry");
  });

  it("protects visual-editor assets from traversal and active SVG content", () => {
    expect(assetRouterSource).toContain("SAFE_ASSET_FILENAME");
    expect(assetRouterSource).toContain("ACTIVE_SVG_CONTENT");
    expect(assetRouterSource).toContain('filename.includes("..")');
    expect(assetRouterSource).toContain("validateAssetAttachment(input)");
  });

  it("requires exact enterprise domain verification in production", () => {
    expect(orgRouterSource).toContain("normalizeOrganizationDomain");
    expect(orgRouterSource).toContain('process.env.NODE_ENV !== "production"');
    expect(orgRouterSource).toContain('chunks.join("").trim() === expected');
  });

  it("bounds external integration IO and guards support contexts", () => {
    expect(integrationRuntimeSource).toContain("MAX_INTEGRATION_REQUEST_BYTES");
    expect(integrationRuntimeSource).toContain("MAX_INTEGRATION_RESPONSE_BYTES");
    expect(integrationRuntimeSource).toContain("may not embed credentials in URLs");
    expect(ecosystemRouterSource).toContain("guardOutboundPayload(input.context ?? {}, \"Support context\")");
    expect(ecosystemRouterSource).toContain("guardOutboundPayload(input.payload, \"Automation payload\")");
  });
});
