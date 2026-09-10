export type AppForgeIntegrationKind = "external" | "internal" | "ecosystem";

export type AppForgeIntegrationDefinition = {
  id: string;
  name: string;
  kind: AppForgeIntegrationKind;
  job: string;
  requiredForProduction: boolean;
  capabilities: string[];
  env: string[];
};

export const APPFORGE_INTEGRATIONS: AppForgeIntegrationDefinition[] = [
  { id: "bubblav", name: "BubblaV AI Chatbot", kind: "external", job: "Customer support, onboarding, FAQs, troubleshooting, and human escalation.", requiredForProduction: false, capabilities: ["support", "onboarding", "faq", "escalation"], env: ["BUBBLAV_API_KEY", "BUBBLAV_HEALTH_URL"] },
  { id: "make", name: "Make", kind: "external", job: "Automation and multi-step workflow orchestration across external applications.", requiredForProduction: false, capabilities: ["automation", "workflows", "webhooks"], env: ["MAKE_API_TOKEN", "MAKE_HEALTH_URL"] },
  { id: "sprites-fly", name: "Sprites / Fly.io", kind: "external", job: "Isolated agent execution plus production application and worker runtime.", requiredForProduction: true, capabilities: ["agent-runtime", "workers", "deployments", "sandboxes"], env: ["FLY_APP_NAME"] },
  { id: "datadog", name: "Datadog", kind: "external", job: "Production infrastructure, API, log, latency, and application monitoring.", requiredForProduction: false, capabilities: ["monitoring", "apm", "logs", "alerts"], env: ["DD_API_KEY", "DD_SITE"] },
  { id: "deep-research", name: "Deep Research", kind: "internal", job: "Research capability used by AppForge agents before decisions, reports, and builds.", requiredForProduction: false, capabilities: ["research", "web-research", "evidence"], env: ["OPENAI_API_KEY"] },
  { id: "documents", name: "Documents", kind: "internal", job: "Create, read, edit, analyze, and manage project documents.", requiredForProduction: false, capabilities: ["documents", "editing", "analysis"], env: [] },
  { id: "default-templates", name: "Default Templates", kind: "internal", job: "Production-oriented project starters for common application types.", requiredForProduction: true, capabilities: ["templates", "starters", "scaffolds"], env: [] },
  { id: "pdf", name: "PDF", kind: "internal", job: "Read, analyze, extract, and generate PDF artifacts.", requiredForProduction: false, capabilities: ["pdf", "reports", "invoices", "specifications"], env: [] },
  { id: "plugin-management", name: "Plugin Management", kind: "internal", job: "Integration registry, verification, capability discovery, and connection status control.", requiredForProduction: true, capabilities: ["plugins", "integrations", "permissions", "health"], env: [] },
  { id: "posthog", name: "PostHog", kind: "external", job: "Product analytics, funnels, retention, experiments, and feature flags.", requiredForProduction: false, capabilities: ["analytics", "funnels", "experiments", "feature-flags"], env: ["POSTHOG_HOST", "POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID"] },
  { id: "presentations", name: "Presentations", kind: "internal", job: "Create and edit pitch decks, reports, proposals, and project presentations.", requiredForProduction: false, capabilities: ["presentations", "slides", "decks"], env: [] },
  { id: "security", name: "Security", kind: "internal", job: "Scan dependencies, applications, infrastructure, and agent activity for security problems.", requiredForProduction: true, capabilities: ["security", "dependency-scan", "code-scan", "policy"], env: [] },
  { id: "spreadsheets", name: "Spreadsheets", kind: "internal", job: "Create and analyze tabular data, budgets, models, inventories, and reports.", requiredForProduction: false, capabilities: ["spreadsheets", "csv", "analytics", "models"], env: [] },
  { id: "stripe", name: "Stripe", kind: "external", job: "Subscriptions, one-time purchases, payment links, invoices, and monetization.", requiredForProduction: true, capabilities: ["payments", "subscriptions", "invoices", "checkout"], env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  { id: "supabase", name: "Supabase", kind: "external", job: "Primary PostgreSQL data platform, authentication, storage, and realtime services.", requiredForProduction: true, capabilities: ["database", "auth", "storage", "realtime"], env: ["SUPABASE_URL", "SUPABASE_ANON_KEY"] },
  { id: "template-creator", name: "Template Creator", kind: "internal", job: "Turn successful AppForge projects into reusable project templates.", requiredForProduction: false, capabilities: ["template-factory", "reuse", "scaffolds"], env: [] },
  { id: "twilio", name: "Twilio", kind: "external", job: "SMS, phone, voice, and communications infrastructure.", requiredForProduction: false, capabilities: ["sms", "voice", "communications"], env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] },
  { id: "vercel", name: "Vercel", kind: "external", job: "Web frontend, API, and preview deployment platform.", requiredForProduction: false, capabilities: ["web-deploy", "preview", "frontend-hosting"], env: ["VERCEL_TOKEN"] },
  { id: "github", name: "GitHub", kind: "external", job: "Source control, branches, commits, pull requests, collaboration, and CI.", requiredForProduction: true, capabilities: ["source-control", "ci", "pull-requests", "issues"], env: ["GITHUB_TOKEN"] },
  { id: "codex-security", name: "Codex Security", kind: "external", job: "Specialized AI-assisted source security review before production deployment.", requiredForProduction: false, capabilities: ["code-security", "review", "vulnerability-analysis"], env: ["CODEX_SECURITY_WEBHOOK_URL", "CODEX_SECURITY_TOKEN"] },
  { id: "marketing-app", name: "TrillionAI Marketing", kind: "ecosystem", job: "Receives AppForge products and turns them into measurable marketing campaigns.", requiredForProduction: true, capabilities: ["campaigns", "content", "seo", "social", "ads"], env: ["MARKETING_APP_URL", "TRILLION_ECOSYSTEM_SHARED_SECRET"] },
  { id: "trillionaitech-site", name: "trillionaitech.com", kind: "ecosystem", job: "Public sales, trust, pricing, discovery, and entry point for the product ecosystem.", requiredForProduction: true, capabilities: ["sales", "discovery", "pricing", "trust"], env: ["TRILLION_PUBLIC_SITE_URL"] },
];

export function getIntegrationDefinition(id: string) {
  return APPFORGE_INTEGRATIONS.find((integration) => integration.id === id);
}
