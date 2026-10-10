import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isolatedRuntimeConfig,
  assertRuntimeProviderAllowed,
} from "../services/isolatedRuntimeConfig.js";
import {
  isolatedBuildConfigured,
  validateWithIsolatedBuildRunner,
} from "../services/isolatedBuildRunner.js";
import {
  isolatedPreviewConfigured,
  ensureIsolatedPreview,
  invalidateIsolatedPreview,
} from "../services/previewRuntime.js";
import { buildArtifactIntegrity } from "../lib/artifactIntegrity.js";
import { getStackAdapter } from "../lib/stackAdapters.js";
import { getIntegrationDefinition } from "../integrations/catalog.js";
import { verifyIntegration } from "../integrations/health.js";
import { createHash } from "node:crypto";
const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
  invalidateIsolatedPreview(940);
});
describe("provider-neutral isolated execution", () => {
  it("uses a generic build and preview runner without Sprites settings", () => {
    process.env.ISOLATED_BUILD_URL = "https://runner.example.test/build";
    process.env.ISOLATED_PREVIEW_URL = "https://runner.example.test/preview";
    process.env.ISOLATED_RUNTIME_TOKEN = "synthetic-runner-token";
    expect(isolatedBuildConfigured()).toBe(true);
    expect(isolatedPreviewConfigured()).toBe(true);
    expect(isolatedRuntimeConfig("build")).toMatchObject({
      provider: "isolated",
      token: "synthetic-runner-token",
    });
  });
  it("does not fall back to Sprites for an incomplete generic configuration", () => {
    process.env.ISOLATED_BUILD_URL = "https://runner.example.test/build";
    delete process.env.ISOLATED_RUNTIME_TOKEN;
    process.env.SPRITES_EXEC_URL = "https://paid.sprites.app/exec";
    process.env.SPRITES_API_TOKEN = "synthetic-legacy-token";
    expect(isolatedBuildConfigured()).toBe(false);
    expect(isolatedPreviewConfigured()).toBe(false);
  });
  it("disables all legacy execution without making a request", async () => {
    process.env.SPRITES_DISABLED = "true";
    process.env.SPRITES_EXEC_URL = "https://paid.sprites.app/exec";
    process.env.SPRITES_API_TOKEN = "synthetic-legacy-token";
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(isolatedBuildConfigured()).toBe(false);
    expect(isolatedPreviewConfigured()).toBe(false);
    expect(
      await validateWithIsolatedBuildRunner(
        { "package.json": "{}" },
        "react-node",
      ),
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("prevents a generic setting from pointing back to disabled Sprites", () => {
    process.env.SPRITES_DISABLED = "true";
    expect(() =>
      assertRuntimeProviderAllowed(new URL("https://paid.sprites.app./build")),
    ).toThrow("disabled");
    expect(() =>
      assertRuntimeProviderAllowed(
        new URL("https://runner.example.test/build"),
      ),
    ).not.toThrow();
  });

  it("sends generic validation with exact artifact and complete proof requirements", async () => {
    process.env.ISOLATED_BUILD_URL = "https://runner.example.test/build";
    process.env.ISOLATED_RUNTIME_TOKEN = "synthetic-runner-token";
    process.env.SPRITES_DISABLED = "true";
    const files = { "package.json": "{}" };
    const hash = createHash("sha256")
      .update(JSON.stringify(files))
      .digest("hex");
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          passed: true,
          isolationId: "reviewed-fixture",
          artifactSha256: hash,
          techStack: "react-node",
          steps: Object.fromEntries(
            ["install", "security", "tests", "build", "runtime"].map((step) => [
              step,
              { passed: true },
            ]),
          ),
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      await validateWithIsolatedBuildRunner(files, "react-node"),
    ).toMatchObject({ passed: true });
    const [url, options] = fetch.mock.calls[0];
    expect(url.toString()).toBe("https://runner.example.test/build");
    expect(options.headers.authorization).toBe("Bearer synthetic-runner-token");
    expect(options.headers["x-appforge-agent-runtime"]).toBe("isolated");
    expect(JSON.parse(options.body)).toMatchObject({
      artifactSha256: hash,
      requiredSteps: ["install", "security", "tests", "build", "runtime"],
    });
  });

  it("does not probe a disabled provider or certify Fly health as build readiness", async () => {
    process.env.FLY_APP_NAME = "appforge-test";
    process.env.SPRITES_DISABLED = "true";
    process.env.SPRITES_HEALTH_URL = "https://paid.sprites.app/health";
    process.env.SPRITES_API_TOKEN = "synthetic-legacy-token";
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("healthy", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = await verifyIntegration(
      getIntegrationDefinition("sprites-fly")!,
    );
    expect(result.verified).toBe(false);
    expect(result.state).toBe("configuration_required");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).toContain("appforge-test.fly.dev");
  });

  it("does not reuse a preview cached by a different provider", async () => {
    process.env.SPRITES_PREVIEW_URL = "https://old.sprites.app/preview";
    process.env.SPRITES_API_TOKEN = "synthetic-legacy-token";
    const files = { "index.html": "<p>reviewed fixture</p>" };
    const artifact = {
      snapshotId: 1,
      version: 1,
      files,
      integrity: buildArtifactIntegrity({
        projectId: 940,
        artifactVersion: 1,
        state: "final",
        files,
      }),
    };
    const input = {
      projectId: 940,
      artifact,
      stack: getStackAdapter("react-node"),
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ url: "https://old.sprites.app/product" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ url: "https://new.example.test/product" }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await ensureIsolatedPreview(input)).toBe(
      "https://old.sprites.app/product",
    );
    process.env.SPRITES_DISABLED = "true";
    process.env.ISOLATED_PREVIEW_URL = "https://new.example.test/preview";
    process.env.ISOLATED_RUNTIME_TOKEN = "synthetic-runner-token";
    expect(await ensureIsolatedPreview(input)).toBe(
      "https://new.example.test/product",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
