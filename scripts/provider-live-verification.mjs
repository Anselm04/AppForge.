import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REQUIRED_PROVIDERS = ["stripe"];
const PROVIDERS = new Set(["vercel", "netlify", "stripe", "supabase-sso"]);
const GITHUB_SHA = /^[a-f0-9]{40}$/i;
const ARTIFACT_SHA = /^[a-f0-9]{64}$/i;

function parseProviders(value) {
  return (value ?? "")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveRequiredProviders(environment) {
  const required = new Set(DEFAULT_REQUIRED_PROVIDERS);
  for (const provider of parseProviders(
    environment.APPFORGE_REQUIRED_LIVE_PROVIDERS,
  )) {
    required.add(provider);
  }
  for (const provider of parseProviders(
    environment.APPFORGE_OPTIONAL_LIVE_PROVIDERS,
  )) {
    required.add(provider);
  }
  if (environment.VERCEL_TOKEN) required.add("vercel");
  if (environment.NETLIFY_AUTH_TOKEN) required.add("netlify");
  if (environment.SUPABASE_SSO_ENABLED === "true") required.add("supabase-sso");
  return [...required].sort();
}

async function getJson(url, headers, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Provider returned HTTP ${response.status}`);
  }
  return response.json();
}

async function verifyVercel(environment, fetchImpl) {
  const token = environment.VERCEL_TOKEN;
  const projectId = environment.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    throw new Error("VERCEL_TOKEN and VERCEL_PROJECT_ID are required.");
  }
  const headers = { Authorization: "Bearer ".concat(token) };
  const project = await getJson(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`,
    headers,
    fetchImpl,
  );
  if (project.id !== projectId) {
    throw new Error(
      "Vercel project identity did not match the configured project.",
    );
  }
  const deployments = await getJson(
    `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=10`,
    headers,
    fetchImpl,
  );
  const ready = (deployments.deployments ?? []).some(
    (deployment) =>
      (deployment.readyState === "READY" || deployment.state === "READY") &&
      typeof deployment.url === "string" &&
      deployment.url.length > 0 &&
      [deployment.meta?.githubCommitSha, deployment.gitSource?.sha].some(
        (commitSha) =>
          typeof commitSha === "string" &&
          commitSha.toLowerCase() === environment.RELEASE_SHA.toLowerCase(),
      ),
  );
  if (!ready) {
    throw new Error(
      "Vercel has no ready production deployment for the exact release commit.",
    );
  }
  return "authenticated project and exact-release production deployment verified";
}

async function verifyNetlify(environment, fetchImpl) {
  const token = environment.NETLIFY_AUTH_TOKEN;
  const siteId = environment.NETLIFY_SITE_ID;
  if (!token || !siteId) {
    throw new Error("NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID are required.");
  }
  const deploys = await getJson(
    `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/deploys?per_page=10`,
    { Authorization: "Bearer ".concat(token) },
    fetchImpl,
  );
  const ready =
    Array.isArray(deploys) &&
    deploys.some(
      (deployment) =>
        deployment.state === "ready" &&
        deployment.context === "production" &&
        typeof deployment.commit_ref === "string" &&
        deployment.commit_ref.toLowerCase() ===
          environment.RELEASE_SHA.toLowerCase() &&
        typeof (
          deployment.ssl_url ??
          deployment.deploy_ssl_url ??
          deployment.url
        ) === "string",
    );
  if (!ready) {
    throw new Error(
      "Netlify has no ready production deploy for the exact release commit.",
    );
  }
  return "authenticated site and exact-release production deploy verified";
}

async function verifyStripe(environment, fetchImpl) {
  const token = environment.STRIPE_SECRET_KEY;
  const appUrl = environment.APP_URL?.replace(/\/+$/, "");
  if (!token || !appUrl) {
    throw new Error("STRIPE_SECRET_KEY and APP_URL are required.");
  }
  if (!token.startsWith("sk_live_")) {
    throw new Error(
      "Paid-customer release verification requires a live Stripe key.",
    );
  }
  await getJson(
    "https://api.stripe.com/v1/account",
    { Authorization: "Bearer ".concat(token) },
    fetchImpl,
  );
  const endpoints = await getJson(
    "https://api.stripe.com/v1/webhook_endpoints?limit=100",
    { Authorization: "Bearer ".concat(token) },
    fetchImpl,
  );
  const expectedUrl = `${appUrl}/api/webhooks/stripe`;
  const activeWebhook = (endpoints.data ?? []).some(
    (endpoint) => endpoint.status === "enabled" && endpoint.url === expectedUrl,
  );
  if (!activeWebhook) {
    throw new Error(
      "Stripe has no enabled webhook for the configured production URL.",
    );
  }
  return "live account and enabled production webhook verified";
}

async function verifySupabaseSso(environment, fetchImpl) {
  const baseUrl = environment.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const providers = await getJson(
    `${baseUrl}/auth/v1/admin/sso/providers`,
    {
      apikey: serviceKey,
      Authorization: "Bearer ".concat(serviceKey),
    },
    fetchImpl,
  );
  const entries = Array.isArray(providers)
    ? providers
    : (providers.sso_providers ?? []);
  if (
    !Array.isArray(entries) ||
    !entries.some((provider) => provider.disabled !== true)
  ) {
    throw new Error("Supabase has no enabled SSO provider.");
  }
  return "authenticated enabled SSO provider verified";
}

const verifierByProvider = {
  vercel: verifyVercel,
  netlify: verifyNetlify,
  stripe: verifyStripe,
  "supabase-sso": verifySupabaseSso,
};

async function writeEvidence(path, evidence) {
  if (!path) return;
  const fullPath = resolve(path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function runProviderVerification({
  environment,
  fetchImpl = fetch,
  dryRun = false,
  production = false,
  evidencePath,
  now = () => new Date(),
}) {
  if (dryRun && (production || environment.NODE_ENV === "production")) {
    throw new Error("Provider dry-run is not allowed for production releases.");
  }
  const releaseId = environment.RELEASE_SHA;
  const artifactId = environment.ARTIFACT_ID;
  if (!GITHUB_SHA.test(releaseId ?? "")) {
    throw new Error("RELEASE_SHA must identify the exact 40-character commit.");
  }
  if (!ARTIFACT_SHA.test(artifactId ?? "")) {
    throw new Error(
      "ARTIFACT_ID must be the 64-character artifact manifest SHA-256.",
    );
  }
  if (production && !evidencePath) {
    throw new Error("Production provider evidence output path is required.");
  }

  const providers = resolveRequiredProviders(environment);
  const evidence = [];
  for (const provider of providers) {
    const record = {
      provider,
      checkedAt: now().toISOString(),
      releaseId,
      artifactId,
      result: dryRun ? "dry_run" : "failed",
    };
    const verifier = verifierByProvider[provider];
    if (!verifier) {
      record.details = "no live verification adapter is registered";
    } else if (!dryRun) {
      try {
        record.details = await verifier(environment, fetchImpl);
        record.result = "verified";
      } catch (error) {
        record.details =
          error instanceof Error
            ? error.message
            : "live provider verification failed";
      }
    } else {
      record.details = "dry-run only; no provider request was made";
    }
    evidence.push(record);
  }

  await writeEvidence(evidencePath, {
    version: 1,
    releaseId,
    artifactId,
    providers: evidence,
  });

  if (evidence.some((record) => record.result !== "verified" && !dryRun)) {
    const failures = evidence
      .filter((record) => record.result !== "verified")
      .map((record) => record.provider);
    throw new Error(
      `Required live provider verification failed: ${failures.join(", ")}.`,
    );
  }
  return evidence;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const production = process.argv.includes("--production");
  const evidencePath = process.env.APPFORGE_PROVIDER_EVIDENCE_PATH;
  const evidence = await runProviderVerification({
    environment: process.env,
    dryRun,
    production,
    evidencePath,
  });
  console.log(
    JSON.stringify(
      evidence.map(
        ({ provider, checkedAt, result, releaseId, artifactId }) => ({
          provider,
          checkedAt,
          result,
          releaseId,
          artifactId,
        }),
      ),
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      "[provider-live-verification] FAILED",
      error instanceof Error ? error.message : "verification failed",
    );
    process.exitCode = 1;
  });
}
