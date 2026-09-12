export type TeamIntegrationStatus = {
  key: string;
  role: string;
  configured: boolean;
  requiredForProduction: boolean;
};

const has = (...names: string[]) => names.some((name) => Boolean(process.env[name]?.trim()));

export function getTeamIntegrationStatus(): TeamIntegrationStatus[] {
  return [
    {
      key: 'github',
      role: 'source-control-ci-cd',
      configured: has('GITHUB_CLIENT_ID', 'GITHUB_TOKEN'),
      requiredForProduction: true,
    },
    {
      key: 'cloudflare',
      role: 'dns-cdn-waf-domain-email-routing',
      configured: has('CLOUDFLARE_ZONE_ID', 'CLOUDFLARE_ACCOUNT_ID'),
      requiredForProduction: true,
    },
    {
      key: 'vercel',
      role: 'frontend-hosting-preview-deployments',
      configured: has('VERCEL_PROJECT_ID', 'VERCEL_URL', 'VERCEL_ENV'),
      requiredForProduction: false,
    },
    {
      key: 'fly',
      role: 'backend-workers-agent-runtime',
      configured: has('FLY_APP_NAME', 'FLY_MACHINE_ID', 'FLY_REGION'),
      requiredForProduction: true,
    },
    {
      key: 'supabase-postgres',
      role: 'database-auth-data-platform',
      configured: has('SUPABASE_URL') && has('DATABASE_URL', 'SUPABASE_DB_URL'),
      requiredForProduction: true,
    },
    {
      key: 'stripe',
      role: 'payments-billing-entitlements',
      configured: has('STRIPE_SECRET_KEY') && has('STRIPE_WEBHOOK_SECRET'),
      requiredForProduction: true,
    },
    {
      key: 'twilio',
      role: 'communications-verification',
      configured: has('TWILIO_ACCOUNT_SID') && has('TWILIO_AUTH_TOKEN'),
      requiredForProduction: true,
    },
    {
      key: 'posthog-eu',
      role: 'product-analytics-feature-flags',
      configured:
        has(
          'POSTHOG_KEY',
          'POSTHOG_PROJECT_API_KEY',
          'VITE_POSTHOG_KEY',
          'VITE_PUBLIC_POSTHOG_KEY',
        ) &&
        has(
          'POSTHOG_HOST',
          'VITE_POSTHOG_HOST',
          'VITE_PUBLIC_POSTHOG_HOST',
        ),
      requiredForProduction: true,
    },
    {
      key: 'datadog-us1',
      role: 'infrastructure-monitoring-apm',
      configured: has('DD_API_KEY') && has('DD_SITE'),
      requiredForProduction: true,
    },
    {
      key: 'sentry',
      role: 'application-error-tracking',
      configured: has('SENTRY_DSN', 'VITE_SENTRY_DSN'),
      requiredForProduction: true,
    },
    {
      key: 'ai-model-layer',
      role: 'model-routing-generation-intelligence',
      configured: has('OPENAI_API_KEY') && has('ANTHROPIC_API_KEY'),
      requiredForProduction: true,
    },
    {
      key: 'make',
      role: 'business-automation-orchestration',
      configured: has('MAKE_WEBHOOK_URL', 'MAKE_API_TOKEN'),
      requiredForProduction: true,
    },
    {
      key: 'bubblav',
      role: 'customer-support-chatbot',
      configured: has('BUBBLAV_API_KEY', 'BUBBLAV_WIDGET_ID'),
      requiredForProduction: true,
    },
  ];
}

export function summarizeTeamIntegrations() {
  const integrations = getTeamIntegrationStatus();
  const configured = integrations.filter((item) => item.configured).length;
  const required = integrations.filter((item) => item.requiredForProduction).length;
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
