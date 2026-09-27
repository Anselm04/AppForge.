import { getStackAdapter } from "./stackAdapters.js";
import type { ProductContract } from "./productContract.js";

export type IntegrationImplementationPolicy = {
  required: boolean;
  requestedIntegrations: string[];
  webhookRequired: boolean;
  serverBoundaryRequired: boolean;
};

const INTEGRATION_CLIENT_PATH =
  /(?:^|\/)(?:src\/)?(?:server\/)?(?:integrations?|clients?|providers?)\/(?!.*(?:health|webhook))/i;
const INTEGRATION_HEALTH_PATH =
  /(?:^|\/)(?:integrations?\/)?(?:health|status)(?:\/|\.|$)|(?:^|\/).*integration.*health/i;
const WEBHOOK_PATH =
  /(?:^|\/)(?:api\/)?webhooks?(?:\/|\.|$)|(?:^|\/).*webhook.*\.(?:ts|js|py|dart)$/i;
const INTEGRATION_DOC_PATH =
  /(?:^|\/)docs\/(?:integrations?|external-services?)\.md$|(?:^|\/)INTEGRATIONS\.md$/i;
const ENV_EXAMPLE_PATH =
  /(?:^|\/)\.env(?:\.example|\.sample|\.template)$|(?:^|\/)env\.example$/i;

const CLIENT_SECRET_PATTERN =
  /\b(?:DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|CLIENT_SECRET|API_SECRET|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN|SERVICE_ROLE_KEY)\b|(?:import\.meta\.env|process\.env)\.[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|SERVICE_ROLE|ACCESS_TOKEN|AUTH_TOKEN)/i;

const WEBHOOK_PROVIDER_PATTERN =
  /\b(?:stripe|shopify|twilio|github|slack|paypal|paddle|square|sendgrid|mailgun)\b/i;

function normalizeIntegrationName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function textEntries(files: Record<string, string>): Array<[string, string]> {
  return Object.entries(files).filter(
    ([path]) => !/\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/i.test(path),
  );
}

function combined(entries: Array<[string, string]>): string {
  return entries.map(([path, source]) => "// " + path + "\n" + source).join("\n");
}

function isServerIntegrationPath(path: string, source: string): boolean {
  if (/^(?:server|api)\//i.test(path)) return true;
  if (/^(?:src\/server|app\/api|lib\/server)\//i.test(path)) return true;
  if (INTEGRATION_CLIENT_PATH.test(path)) return true;
  if (WEBHOOK_PATH.test(path)) return true;
  if (/["']use server["']/.test(source)) return true;
  return false;
}

function isClientExposedPath(
  path: string,
  source: string,
  contract: ProductContract,
): boolean {
  if (/\.env(?:\.|$)/i.test(path) || /\.md$/i.test(path)) return false;
  const adapter = getStackAdapter(contract.selectedTechnologyStack);

  if (["browser", "mobile", "extension"].includes(adapter.runtime)) {
    return /\.(?:[cm]?[jt]sx?|dart|html)$/i.test(path);
  }
  if (/["']use client["']/.test(source)) return true;
  if (isServerIntegrationPath(path, source)) return false;
  if (adapter.id === "react-node") {
    return /\.(?:tsx|jsx)$/i.test(path) || /^src\/(?:components|pages|hooks)\//i.test(path);
  }
  if (adapter.id === "next-node") {
    return /\.(?:tsx|jsx)$/i.test(path) && !/^app\/api\//i.test(path);
  }
  return false;
}

export function integrationImplementationPolicy(
  contract: ProductContract,
): IntegrationImplementationPolicy {
  const requestedIntegrations = [
    ...new Set(contract.integrations.map((value) => value.trim()).filter(Boolean)),
  ];
  const requirementText = [
    ...contract.coreWorkflows,
    ...contract.functionalRequirements.map((requirement) => requirement.text),
    ...contract.nonFunctionalRequirements,
    ...contract.securityRequirements,
  ].join(" ");

  const required =
    requestedIntegrations.length > 0 ||
    contract.secondaryCapabilities.includes("external_integrations") ||
    contract.productFamilies.includes("integrations");

  const webhookRequired =
    required &&
    (/\b(webhook|callback|event subscription|event delivery)\b/i.test(
      requirementText,
    ) ||
      requestedIntegrations.some((integration) =>
        WEBHOOK_PROVIDER_PATTERN.test(integration),
      ));

  return {
    required,
    requestedIntegrations,
    webhookRequired,
    serverBoundaryRequired: required,
  };
}

export function integrationCompatibilityProblems(
  contract: ProductContract,
): string[] {
  const policy = integrationImplementationPolicy(contract);
  if (!policy.required) return [];

  const adapter = getStackAdapter(contract.selectedTechnologyStack);
  const problems: string[] = [];

  if (
    policy.serverBoundaryRequired &&
    ["browser", "extension"].includes(adapter.runtime) &&
    !contract.productFamilies.includes("backend")
  ) {
    problems.push(
      "integration compatibility: secret-bearing external integrations require a server/backend boundary for this stack",
    );
  }

  if (
    policy.webhookRequired &&
    ["browser", "extension", "mobile"].includes(adapter.runtime) &&
    !contract.productFamilies.includes("backend")
  ) {
    problems.push(
      "integration compatibility: webhook-capable integrations require a server/backend receiver",
    );
  }

  return problems;
}

export function isIntegrationClientPath(path: string): boolean {
  return INTEGRATION_CLIENT_PATH.test(path) && !INTEGRATION_HEALTH_PATH.test(path);
}

export function isIntegrationHealthPath(path: string): boolean {
  return INTEGRATION_HEALTH_PATH.test(path);
}

export function isIntegrationWebhookPath(path: string): boolean {
  return WEBHOOK_PATH.test(path);
}

export function isIntegrationDocsPath(path: string): boolean {
  return INTEGRATION_DOC_PATH.test(path);
}

export function isIntegrationEnvPath(path: string): boolean {
  return ENV_EXAMPLE_PATH.test(path);
}

export function integrationPlannerInstruction(contract: ProductContract): string {
  const policy = integrationImplementationPolicy(contract);
  if (!policy.required) return "";

  return [
    "INTEGRATION PLAN — mandatory for this contract:",
    "- Requested integrations: " +
      (policy.requestedIntegrations.join(", ") ||
        "external provider(s) named by the product requirements") +
      ".",
    "- Include at least one task owned by the integration agent.",
    "- Plan server-side provider client(s), environment example/configuration, integration health/status implementation, and docs/INTEGRATIONS.md.",
    "- Validate provider/stack compatibility before code generation. Secret-bearing provider calls must not originate from browser/mobile client code.",
    "- Provider calls must have explicit timeout handling, bounded retries with backoff, retryable-status classification, 429/Retry-After handling, and explicit production-safe errors.",
    "- Health/status must distinguish unconfigured, configured-but-unverified/degraded, and actively verified connection states. An environment variable alone is never proof of connection.",
    policy.webhookRequired
      ? "- This contract requires webhook/callback handling: plan a server webhook route with signature verification, duplicate-event/idempotency protection, bounded body handling, and replay-safe processing."
      : "- Do not invent a webhook receiver unless the provider/workflow needs one.",
    "- Setup docs must name required environment variables without embedding secret values and explain how connection verification works.",
    "- Never expose provider secrets, client secrets, access tokens, webhook secrets, private keys, or service-role credentials in generated client bundles.",
  ].join("\n");
}

export function integrationCoderInstruction(contract: ProductContract): string {
  const policy = integrationImplementationPolicy(contract);
  if (!policy.required) return "";

  return [
    "Integration implementation requirements:",
    "- Implement the requested providers from the canonical contract: " +
      (policy.requestedIntegrations.join(", ") ||
        "the contract external integration requirements") +
      ".",
    "- Implement provider clients on a server/runtime boundary and read secret credentials from server environment only.",
    "- Validate required configuration and return an explicit unconfigured state when values are absent.",
    "- Use bounded network timeouts and bounded retries with jitter/backoff only for retry-safe failures.",
    "- Handle provider 429 responses using Retry-After or a bounded fallback delay; do not busy-loop.",
    "- Surface production-safe integration errors with stable states/codes instead of pretending the operation succeeded.",
    "- Implement a health/status check that performs provider-safe verification when possible; configured is not connected until verification succeeds.",
    policy.webhookRequired
      ? "- Implement webhook/callback verification using the provider signature scheme, reject invalid/stale signatures, and persist or otherwise atomically guard provider event IDs against duplicate processing."
      : "- Webhook handling is not mandatory unless required by the provider/workflow.",
    "- Add docs/INTEGRATIONS.md with setup, required environment variable names, verification steps, webhook configuration when applicable, retry/rate-limit behavior, and troubleshooting.",
    "- Never emit provider secret values or secret-bearing environment access in browser/mobile/client code.",
  ].join("\n");
}

export function validateIntegrationArtifact(input: {
  files: Record<string, string>;
  contract: ProductContract;
}): string[] {
  const policy = integrationImplementationPolicy(input.contract);
  if (!policy.required) return [];

  const entries = textEntries(input.files);
  const clientEntries = entries.filter(
    ([path, source]) =>
      isIntegrationClientPath(path) || isServerIntegrationPath(path, source),
  );
  const healthEntries = entries.filter(([path]) => isIntegrationHealthPath(path));
  const webhookEntries = entries.filter(([path]) => isIntegrationWebhookPath(path));
  const docsEntries = entries.filter(([path]) => isIntegrationDocsPath(path));
  const envEntries = entries.filter(([path]) => isIntegrationEnvPath(path));

  const clientSource = combined(clientEntries);
  const healthSource = combined(healthEntries);
  const webhookSource = combined(webhookEntries);
  const docsSource = combined(docsEntries);
  const envSource = combined(envEntries);
  const allSource = combined(entries);
  const problems = integrationCompatibilityProblems(input.contract);

  if (clientEntries.length === 0) {
    problems.push("integration contract: missing server-side integration client");
  }
  if (envEntries.length === 0) {
    problems.push("integration contract: missing environment example/configuration");
  }
  if (healthEntries.length === 0) {
    problems.push("integration contract: missing integration health/status implementation");
  }
  if (docsEntries.length === 0) {
    problems.push("integration contract: missing integration setup documentation");
  }
  if (policy.webhookRequired && webhookEntries.length === 0) {
    problems.push("integration contract: missing webhook/callback handler");
  }

  const normalizedAll = normalizeIntegrationName(allSource);
  for (const integration of policy.requestedIntegrations) {
    const token = normalizeIntegrationName(integration);
    if (token && !normalizedAll.includes(token)) {
      problems.push(
        "integration contract: requested integration is not represented in generated artifacts: " +
          integration,
      );
    }
  }

  if (
    clientEntries.length > 0 &&
    !/AbortSignal\.timeout|AbortController|setTimeout\s*\(/i.test(clientSource)
  ) {
    problems.push("integration contract: provider client has no bounded timeout handling");
  }

  if (
    clientEntries.length > 0 &&
    !/retry|backoff|attempt|MAX_RETRIES|MAX_ATTEMPTS/i.test(clientSource)
  ) {
    problems.push("integration contract: provider client has no bounded retry handling");
  }

  if (
    clientEntries.length > 0 &&
    !/429|Retry-After|retry-after|rate.?limit/i.test(clientSource)
  ) {
    problems.push("integration contract: provider client has no rate-limit handling");
  }

  if (
    clientEntries.length > 0 &&
    !/try\s*\{|catch\s*\(|except\s+|finally\s*\{/i.test(clientSource)
  ) {
    problems.push("integration contract: provider client has no explicit error handling");
  }

  if (
    clientEntries.length > 0 &&
    !/not configured|unconfigured|configuration_required|missing configuration/i.test(
      clientSource,
    )
  ) {
    problems.push(
      "integration contract: provider client does not expose an unconfigured state",
    );
  }

  if (
    healthEntries.length > 0 &&
    !/verified|verification|probe|health|status/i.test(healthSource)
  ) {
    problems.push(
      "integration contract: health implementation does not verify provider state",
    );
  }

  if (
    healthEntries.length > 0 &&
    /connected[\s\S]{0,120}(?:Boolean\(|process\.env|import\.meta\.env)|(?:process\.env|import\.meta\.env)[\s\S]{0,120}connected/i.test(
      healthSource,
    ) &&
    !/verified|probe|request|fetch/i.test(healthSource)
  ) {
    problems.push(
      "integration contract: health claims connection from configuration without active verification",
    );
  }

  if (policy.webhookRequired && webhookEntries.length > 0) {
    if (
      !/signature|constructEvent|verifyWebhook|verifySignature|timingSafeEqual|hmac/i.test(
        webhookSource,
      )
    ) {
      problems.push(
        "integration contract: webhook handler has no signature verification",
      );
    }
    if (
      !/event.?id|idempot|duplicate|processed.?event|dedup/i.test(webhookSource)
    ) {
      problems.push(
        "integration contract: webhook handler has no duplicate-event protection",
      );
    }
  }

  if (docsEntries.length > 0) {
    for (const term of ["environment", "verify", "retry", "rate", "troubleshoot"]) {
      if (!new RegExp(term, "i").test(docsSource)) {
        problems.push(
          "integration contract: setup docs do not cover " + term + " guidance",
        );
      }
    }
    if (policy.webhookRequired && !/webhook|callback/i.test(docsSource)) {
      problems.push(
        "integration contract: setup docs do not cover webhook configuration",
      );
    }
  }

  if (
    envEntries.length > 0 &&
    /(?:SECRET|TOKEN|PRIVATE_KEY|SERVICE_ROLE|PASSWORD)\s*=\s*[^\s#][^\r\n]*/i.test(
      envSource,
    )
  ) {
    problems.push(
      "integration contract: environment example contains a secret-like value",
    );
  }

  for (const [path, source] of entries) {
    if (
      isClientExposedPath(path, source, input.contract) &&
      CLIENT_SECRET_PATTERN.test(source)
    ) {
      problems.push(
        "integration contract: client-exposed file references provider secret material: " +
          path,
      );
    }
  }

  if (
    /(?:CLIENT_SECRET|API_SECRET|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN|SERVICE_ROLE_KEY)\s*=\s*["'\x60][^"'\x60\r\n]{8,}["'\x60]/i.test(
      allSource,
    )
  ) {
    problems.push("integration contract: hard-coded provider credential detected");
  }

  return [...new Set(problems)];
}
