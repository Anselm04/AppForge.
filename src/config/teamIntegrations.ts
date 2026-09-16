import { getIntegrationDefinition } from "../integrations/catalog.js";
import { hasConfiguredLlmProvider } from "../lib/llmProviderConfig.js";

export type TeamIntegrationStatus = {
  key: string;
  role: string;
  configured: boolean;
  requiredForProduction: boolean;
};

const has = (...names: string[]) =>
  names.some((name) => Boolean(process.env[name]?.trim()));

const all = (...names: string[]) =>
  names.every((name) => Boolean(process.env[name]?.trim()));

function canonicalRequired(id: string, fallback: boolean) {
  return getIntegrationDefinition(id)?.requiredForProduction ?? fallback;
}

export function getTeamIntegrationStatus(): TeamIntegrationStatus[] {
  return [
    {
      key: "github",
      role: "source-control-ci-cd",
      configured: has("GITHUB_CLIENT_ID", "GITHUB_TOKEN"),
      requiredForProduction: canonicalRequired("github", true),
    },
    {
      key: "cloudflare",
      role: "dns-cdn-waf-domain-email-routing",
      configured: has("CLOUDFLARE_ZONE_ID", "CLOUDFLARE_ACCOUNT_ID"),
      requiredForProduction: true,
    },
    {
      key: "vercel",
      role: "frontend-hosting-preview-deployments",
      configured: has("VERCEL_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_URL"),
      requiredForProduction: canonicalRequired("vercel", false),
    },
    {
      key: "fly",
      role: "backend-workers-agent-runtime",
      configured:
        has("FLY_APP_NAME") &&
        has("FLY_API_TOKEN") &&
        all("SPRITES_HEALTH_URL", "SPRITES_EXEC_URL", "SPRITES_API_TOKEN"),
      requiredForProduction: canonicalRequired("sprites-fly", true),
    },
    {
      key: "supabase-postgres",
      role: "database-auth-data-platform",
      configured:
        has("SUPABASE_URL", "VITE_SUPABASE_URL") &&
        has(
          "SUPABASE_ANON_KEY",
          "VITE_SUPABASE_ANON_KEY",
          "VITE_SUPABASE_PUBLISHABLE_KEY",
        ) &&
        has("DATABASE_URL", "SUPABASE_DB_URL"),
      requiredForProduction: canonicalRequired("supabase", true),
    },
    {
      key: "stripe",
      role: "payments-billing-entitlements",
      configured: all("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"),
      requiredForProduction: canonicalRequired("stripe", true),
    },
    {
      key: "twilio",
      role: "communications-verification",
      configured:
        all("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN") &&
        has("TWILIO_VERIFY_SERVICE_SID", "TWILIO_PHONE_NUMBER"),
      requiredForProduction: canonicalRequired("twilio", false),
    },
    {
      key: "posthog-eu",
      role: "product-analytics-feature-flags",
      configured:
        has("POSTHOG_KEY", "VITE_POSTHOG_KEY") &&
        has("POSTHOG_HOST", "VITE_POSTHOG_HOST"),
      requiredForProduction: canonicalRequired("posthog", false),
    },
    {
      key: "datadog-us1",
      role: "infrastructure-monitoring-apm",
      configured: has("DD_API_KEY"),
      requiredForProduction: canonicalRequired("datadog", false),
    },
    {
      key: "sentry",
      role: "application-error-tracking",
      configured: has("SENTRY_DSN", "VITE_SENTRY_DSN"),
      requiredForProduction: canonicalRequired("sentry", false),
    },
    {
      key: "ai-model-layer",
      role: "model-routing-generation-intelligence",
      configured: hasConfiguredLlmProvider(process.env),
      requiredForProduction: true,
    },
    {
      key: "make",
      role: "business-automation-orchestration",
      configured:
        has("MAKE_WEBHOOK_URL") || all("MAKE_HEALTH_URL", "MAKE_API_TOKEN"),
      requiredForProduction: canonicalRequired("make", false),
    },
    {
      key: "bubblav",
      role: "customer-support-chatbot",
      configured:
        all("BUBBLAV_API_KEY", "BUBBLAV_HEALTH_URL") &&
        has("BUBBLAV_CHAT_URL", "BUBBLAV_API_URL"),
      requiredForProduction: canonicalRequired("bubblav", false),
    },
  ];
}

export function summarizeTeamIntegrations() {
  const integrations = getTeamIntegrationStatus();
  const configured = integrations.filter((item) => item.configured).length;
  const required = integrations.filter(
    (item) => item.requiredForProduction,
  ).length;
  const configuredRequired = integrations.filter(
    (item) => item.requiredForProduction && item.configured,
  ).length;

  return {
    configured,
    required,
    productionReady: configuredRequired === required,
    integrations,
  };
}
