import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pathToFileURL } from "node:url";

const script = (name: string) =>
  import(pathToFileURL(join(process.cwd(), "scripts", name)).href);
const branchProtection = await script("verify-branch-protection.mjs");
const sentryRelease = await script("validate-sentry-release.mjs");
const providerVerification = await script("provider-live-verification.mjs");

const releaseSha = "a".repeat(40);
const artifactId = "b".repeat(64);
type ProviderResult = { provider: string; result: string };
const temporaryDirectories: string[] = [];

async function evidencePath() {
  const directory = await mkdtemp(join(tmpdir(), "appforge-release-gates-"));
  temporaryDirectories.push(directory);
  return join(directory, "evidence.json");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("production release gates", () => {
  it("requires Sentry release credentials and the exact deterministic release", () => {
    expect(() =>
      sentryRelease.validateSentryReleaseConfig({}, { production: true }),
    ).toThrow(/SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT, RELEASE_SHA/);

    expect(
      sentryRelease.validateSentryReleaseConfig(
        {
          SENTRY_AUTH_TOKEN: "fixture-token",
          SENTRY_ORG: "fixture-org",
          SENTRY_PROJECT: "fixture-project",
          RELEASE_SHA: releaseSha,
          SENTRY_RELEASE: `appforge@${releaseSha}`,
        },
        { production: true },
      ),
    ).toMatchObject({ valid: true, release: `appforge@${releaseSha}` });

    expect(() =>
      sentryRelease.validateSentryReleaseConfig(
        {
          SENTRY_AUTH_TOKEN: "fixture-token",
          SENTRY_ORG: "fixture-org",
          SENTRY_PROJECT: "fixture-project",
          RELEASE_SHA: releaseSha,
          SENTRY_RELEASE: "appforge@other",
        },
        { production: true },
      ),
    ).toThrow(/SENTRY_RELEASE must equal/);
    expect(
      sentryRelease.validateSentryReleaseConfig({}, { production: false }),
    ).toMatchObject({
      valid: true,
    });
  });

  it("accepts only branch protection with required checks, reviews, and safe update rules", () => {
    expect(
      branchProtection.isSuitableClassicProtection({
        required_status_checks: { strict: true, contexts: ["CI Release Gate"] },
        required_pull_request_reviews: {
          required_approving_review_count: 1,
        },
        allow_force_pushes: { enabled: false },
        allow_deletions: { enabled: false },
      }),
    ).toBe(true);
    expect(
      branchProtection.isSuitableClassicProtection({
        required_status_checks: { contexts: [] },
        required_pull_request_reviews: {
          required_approving_review_count: 0,
        },
        allow_force_pushes: { enabled: true },
        allow_deletions: { enabled: false },
      }),
    ).toBe(false);

    expect(
      branchProtection.isSuitableMainRuleset({
        enforcement: "active",
        conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
        bypass_actors: [],
        rules: [
          {
            type: "required_status_checks",
            parameters: {
              required_status_checks: [{ context: "CI Release Gate" }],
            },
          },
          {
            type: "pull_request",
            parameters: { required_approving_review_count: 1 },
          },
          { type: "non_fast_forward" },
          { type: "deletion" },
        ],
      }),
    ).toBe(true);
  });

  it("fails closed when GitHub cannot verify branch governance", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => [],
    });
    await expect(
      branchProtection.verifyBranchProtection({
        repository: "owner/repo",
        token: "metadata-read-fixture",
        fetchImpl,
      }),
    ).rejects.toThrow(/could not verify main branch protection/);
  });

  it("falls back to an active suitable ruleset when classic protection is absent", async () => {
    const ruleset = {
      enforcement: "active",
      conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
      bypass_actors: [],
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: [{ context: "CI Release Gate" }],
          },
        },
        {
          type: "pull_request",
          parameters: { required_approving_review_count: 1 },
        },
        { type: "non_fast_forward" },
        { type: "deletion" },
      ],
    };
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/protection")) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      if (url.endsWith("/rulesets?includes_parents=true")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 1, enforcement: "active" }],
        };
      }
      return { ok: true, status: 200, json: async () => ruleset };
    });
    await expect(
      branchProtection.verifyBranchProtection({
        repository: "owner/repo",
        token: "metadata-read-fixture",
        fetchImpl,
      }),
    ).resolves.toMatchObject({ method: "repository-ruleset" });
  });

  it("requires live evidence for mandatory and configured provider integrations", () => {
    expect(providerVerification.resolveRequiredProviders({})).toEqual([
      "stripe",
    ]);
    expect(
      providerVerification.resolveRequiredProviders({
        VERCEL_TOKEN: "configured",
        SUPABASE_SSO_ENABLED: "true",
      }),
    ).toEqual(["stripe", "supabase-sso", "vercel"]);
  });

  it("records sanitized provider proof with exact release and artifact identities", async () => {
    const path = await evidencePath();
    const stripeKey = ["sk", "live", "verification-fixture"].join("_");
    const requests: { url: string; authorization?: string }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      requests.push({
        url,
        authorization:
          new Headers(init.headers).get("authorization") ?? undefined,
      });
      const body = url.includes("/v9/projects/")
        ? { id: "project-id" }
        : url.includes("/v6/deployments")
          ? {
              deployments: [
                {
                  readyState: "READY",
                  url: "app.vercel.app",
                  meta: { githubCommitSha: releaseSha },
                },
              ],
            }
          : url.endsWith("/v1/account")
            ? { id: "acct_fixture" }
            : {
                data: [
                  {
                    status: "enabled",
                    url: "https://app.example.test/api/webhooks/stripe",
                  },
                ],
              };
      return { ok: true, status: 200, json: async () => body };
    });
    const evidence = (await providerVerification.runProviderVerification({
      environment: {
        RELEASE_SHA: releaseSha,
        ARTIFACT_ID: artifactId,
        APP_URL: "https://app.example.test/",
        APPFORGE_REQUIRED_LIVE_PROVIDERS: "vercel",
        VERCEL_TOKEN: "vercel-fixture-token",
        VERCEL_PROJECT_ID: "project-id",
        STRIPE_SECRET_KEY: stripeKey,
      },
      fetchImpl,
      production: true,
      evidencePath: path,
      now: () => new Date("2026-09-30T23:00:00.000Z"),
    })) as ProviderResult[];

    expect(evidence.map((item) => item.result)).toEqual([
      "verified",
      "verified",
    ]);
    expect(requests).toHaveLength(4);
    const saved = await readFile(path, "utf8");
    expect(saved).toContain(releaseSha);
    expect(saved).toContain(artifactId);
    expect(saved).not.toContain(stripeKey);
    expect(saved).not.toContain("vercel-fixture-token");
  });

  it("rejects a Netlify deploy that does not match the release commit", async () => {
    const path = await evidencePath();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        {
          state: "ready",
          context: "production",
          commit_ref: "c".repeat(40),
          url: "app.netlify.app",
        },
      ],
    }));

    await expect(
      providerVerification.runProviderVerification({
        environment: {
          RELEASE_SHA: releaseSha,
          ARTIFACT_ID: artifactId,
          APPFORGE_REQUIRED_LIVE_PROVIDERS: "netlify",
          NETLIFY_AUTH_TOKEN: "netlify-fixture-token",
          NETLIFY_SITE_ID: "site-id",
        },
        fetchImpl,
        production: true,
        evidencePath: path,
      }),
    ).rejects.toThrow(/Required live provider verification failed: netlify/);

    const evidence = JSON.parse(await readFile(path, "utf8"));
    expect(evidence.providers).toMatchObject([
      {
        provider: "netlify",
        result: "failed",
        details:
          "Netlify has no ready production deploy for the exact release commit.",
      },
      { provider: "stripe", result: "failed" },
    ]);
    expect(await readFile(path, "utf8")).not.toContain("netlify-fixture-token");
  });

  it("allows non-production dry runs but refuses production dry runs", async () => {
    const evidence = (await providerVerification.runProviderVerification({
      environment: {
        NODE_ENV: "test",
        RELEASE_SHA: releaseSha,
        ARTIFACT_ID: artifactId,
        APPFORGE_REQUIRED_LIVE_PROVIDERS: "netlify",
      },
      dryRun: true,
      fetchImpl: vi.fn(),
    })) as ProviderResult[];
    expect(evidence.map((record) => record.result)).toEqual([
      "dry_run",
      "dry_run",
    ]);

    await expect(
      providerVerification.runProviderVerification({
        environment: {
          NODE_ENV: "production",
          RELEASE_SHA: releaseSha,
          ARTIFACT_ID: artifactId,
        },
        dryRun: true,
      }),
    ).rejects.toThrow(/not allowed for production/);
  });
});
