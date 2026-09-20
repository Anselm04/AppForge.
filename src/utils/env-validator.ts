/**
 * Environment Variable Validator
 * Runtime validation for environment variables.
 */

import {
  hasConfiguredLlmProvider,
  LLM_PROVIDER_ENV_HINT,
} from "../lib/llmProviderConfig.js";

export interface EnvConfig {
  NODE_ENV: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_STARTER_PRICE_ID?: string;
  STRIPE_BUILDER_PRICE_ID?: string;
  STRIPE_STUDIO_PRICE_ID?: string;
  STRIPE_ENTERPRISE_PRICE_ID?: string;
  STRIPE_CUSTOM_PRICE_ID?: string;
  STRIPE_CREDITS_50_PRICE_ID?: string;
  STRIPE_CREDITS_100_PRICE_ID?: string;
  STRIPE_CREDITS_250_PRICE_ID?: string;
  REDIS_URL?: string;
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  VITE_SENTRY_DSN?: string;
  DATABASE_URL?: string;
  SUPABASE_DB_URL?: string;
  JWT_SECRET?: string;
  COOKIE_SECRET?: string;
  CORS_ORIGIN?: string;
  APP_URL?: string;
  PUBLIC_APP_URL?: string;
  REQUEST_TIMEOUT_MS?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  COSINE_API_KEY?: string;
  COSINE_API_URL?: string;
  VITE_APP_ID?: string;
  OWNER_EMAIL?: string;
  OWNER_PHONE?: string;
  OWNER_OPEN_ID?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  HCAPTCHA_SECRET?: string;
  VANTA_WORKSPACE_ID?: string;
  VANTA_API_TOKEN?: string;
  RESEND_API_KEY?: string;
  VERCEL_TOKEN?: string;
  VERCEL_TEAM_ID?: string;
  NETLIFY_AUTH_TOKEN?: string;
  FLY_API_TOKEN?: string;
  BUILT_IN_FORGE_API_URL?: string;
  BUILT_IN_FORGE_API_KEY?: string;
  FORGE_API_KEY?: string;
  GROQ_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  MISTRAL_API_KEY?: string;
  TOGETHER_API_KEY?: string;
  FIREWORKS_API_KEY?: string;
  HF_TOKEN?: string;
  HUGGINGFACE_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_ENABLED?: string;
  OPENAI_COMPAT_BASE_URL?: string;
  OPENAI_COMPAT_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_BILLING_PRICE_KEYS = [
  "STRIPE_STARTER_PRICE_ID",
  "STRIPE_BUILDER_PRICE_ID",
  "STRIPE_STUDIO_PRICE_ID",
  "STRIPE_CREDITS_50_PRICE_ID",
  "STRIPE_CREDITS_100_PRICE_ID",
  "STRIPE_CREDITS_250_PRICE_ID",
] as const;

function llmReady(config: Partial<EnvConfig>): boolean {
  return hasConfiguredLlmProvider(config as Record<string, string | undefined>);
}

export function validateEnv(
  config: Partial<EnvConfig> = process.env as any,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = config.NODE_ENV === "production";

  if (!config.NODE_ENV) {
    errors.push(
      "NODE_ENV is not set. Set to development, staging, or production.",
    );
  } else if (
    !["development", "staging", "production", "test"].includes(config.NODE_ENV)
  ) {
    warnings.push(
      `NODE_ENV is "${config.NODE_ENV}". Expected: development, staging, production, or test.`,
    );
  }

  // Drizzle needs a PostgreSQL connection string. A Supabase HTTPS API URL is
  // not a database connection and must never satisfy this production gate.
  const databaseUrl = config.DATABASE_URL || config.SUPABASE_DB_URL;
  if (!databaseUrl) {
    if (isProduction) {
      errors.push(
        "PostgreSQL connection required: Set DATABASE_URL or SUPABASE_DB_URL",
      );
    } else {
      warnings.push("No PostgreSQL connection configured.");
    }
  } else if (!databaseUrl.startsWith("postgresql://")) {
    errors.push("Invalid database URL format. Expected postgresql://");
  }

  // Supabase Auth is a separate production dependency from PostgreSQL.
  const supabaseUrl = config.VITE_SUPABASE_URL || config.SUPABASE_URL;
  const supabaseAuthKey =
    config.SUPABASE_SERVICE_ROLE_KEY ||
    config.VITE_SUPABASE_PUBLISHABLE_KEY ||
    config.VITE_SUPABASE_ANON_KEY ||
    config.SUPABASE_ANON_KEY;
  if (isProduction && !supabaseUrl) {
    errors.push(
      "Supabase Auth URL required: Set VITE_SUPABASE_URL or SUPABASE_URL",
    );
  }
  if (isProduction && !supabaseAuthKey) {
    errors.push(
      "Supabase Auth key required: Set a publishable/anon key or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  if (supabaseUrl && !supabaseUrl.startsWith("https://")) {
    errors.push("Invalid Supabase URL format. Expected https://");
  }

  if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
    if (isProduction) {
      errors.push(
        "JWT_SECRET is required and must be at least 32 characters in production",
      );
    } else {
      warnings.push("JWT_SECRET should be at least 32 characters for security");
    }
  }
  if (!config.COOKIE_SECRET || config.COOKIE_SECRET.length < 32) {
    if (isProduction) {
      errors.push(
        "COOKIE_SECRET is required and must be at least 32 characters in production",
      );
    } else {
      warnings.push(
        "COOKIE_SECRET should be at least 32 characters for security",
      );
    }
  }

  if (config.REQUEST_TIMEOUT_MS) {
    const timeout = parseInt(config.REQUEST_TIMEOUT_MS, 10);
    if (isNaN(timeout) || timeout < 5000 || timeout > 360000) {
      errors.push(
        "REQUEST_TIMEOUT_MS must be a number between 5000 and 360000",
      );
    }
  }

  if (isProduction && !config.CORS_ORIGIN) {
    warnings.push(
      "CORS_ORIGIN not set. For production, explicitly set your allowed origin.",
    );
  }

  // Billing is OPTIONAL for the core product. The platform must boot and allow
  // sign-up, login, building and deploying even when Stripe is not configured.
  // If the operator HAS enabled billing (STRIPE_SECRET_KEY present), then the
  // rest of the billing configuration must be complete — a half-configured
  // payment system is dangerous, so those stay hard errors.
  const billingEnabled = Boolean(config.STRIPE_SECRET_KEY);
  if (isProduction && !billingEnabled) {
    warnings.push(
      "STRIPE_SECRET_KEY not set. Billing/credits are disabled; core sign-up, login, build and deploy still work.",
    );
  }
  if (billingEnabled && !config.STRIPE_WEBHOOK_SECRET) {
    errors.push(
      "STRIPE_WEBHOOK_SECRET is required when Stripe billing is enabled (STRIPE_SECRET_KEY is set)",
    );
  }
  if (config.STRIPE_SECRET_KEY && !config.STRIPE_SECRET_KEY.startsWith("sk_")) {
    errors.push("Invalid STRIPE_SECRET_KEY format. Should start with sk_");
  }
  if (config.STRIPE_SECRET_KEY?.includes("sk_test_") && isProduction) {
    errors.push("Test Stripe key (sk_test_) used in production environment");
  }
  if (
    config.STRIPE_WEBHOOK_SECRET &&
    !config.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")
  ) {
    errors.push(
      "Invalid STRIPE_WEBHOOK_SECRET format. Should start with whsec_",
    );
  }

  const missingBillingPriceIds = REQUIRED_BILLING_PRICE_KEYS.filter(
    (key) => !config[key],
  );
  if (missingBillingPriceIds.length > 0) {
    const message = `Missing Stripe billing price IDs: ${missingBillingPriceIds.join(", ")}`;
    // Only a hard error when billing is actually enabled. Without a Stripe
    // secret key the catalog is irrelevant and must not block startup.
    if (billingEnabled) {
      errors.push(message);
    } else if (isProduction) {
      warnings.push(`${message} (billing disabled — informational only).`);
    }
  }

  // AppForge scales horizontally with Redis, but a single-machine production
  // deployment is a valid, supported configuration. Missing Redis therefore
  // degrades gracefully to in-memory coordination instead of blocking startup
  // (which previously made sign-up/login/build impossible on first deploy).
  if (isProduction && !config.REDIS_URL) {
    warnings.push(
      "REDIS_URL not set. Running in single-machine mode (in-memory rate limiting and build events). Set REDIS_URL for multi-machine/horizontal scaling.",
    );
  }
  if (
    config.REDIS_URL &&
    !config.REDIS_URL.startsWith("redis://") &&
    !config.REDIS_URL.startsWith("rediss://")
  ) {
    errors.push("Invalid REDIS_URL format. Expected redis:// or rediss://");
  }

  if (!config.OWNER_EMAIL) {
    errors.push(
      "OWNER_EMAIL is required. Used for admin dashboard access, ban notifications, and compliance records.",
    );
  }
  if (!config.SUPABASE_SERVICE_ROLE_KEY && isProduction) {
    warnings.push(
      "SUPABASE_SERVICE_ROLE_KEY not set. Auth can use a publishable/anon key, but admin Supabase operations may be unavailable.",
    );
  }

  if (config.TWILIO_ACCOUNT_SID && !config.TWILIO_AUTH_TOKEN) {
    warnings.push(
      "TWILIO_ACCOUNT_SID set but TWILIO_AUTH_TOKEN missing. SMS verification will not work.",
    );
  }

  if (!config.HCAPTCHA_SECRET && isProduction) {
    warnings.push(
      "HCAPTCHA_SECRET not set. Project creation has no bot protection in production.",
    );
  }

  if (config.VANTA_WORKSPACE_ID && !config.VANTA_API_TOKEN) {
    warnings.push(
      "VANTA_WORKSPACE_ID set but VANTA_API_TOKEN missing. Direct API sync disabled; JSON export still works.",
    );
  }

  if (config.OWNER_EMAIL && !config.RESEND_API_KEY && isProduction) {
    warnings.push(
      "RESEND_API_KEY not set. Email notifications (bans, god codes, welcome) will not be sent.",
    );
  }

  if (!config.VERCEL_TOKEN) {
    warnings.push(
      "VERCEL_TOKEN not set. One-click deployments disabled. ZIP download still works.",
    );
  }

  if (!llmReady(config)) {
    const message = `No AI provider configured. Set at least one supported provider: ${LLM_PROVIDER_ENV_HINT}.`;
    if (isProduction) {
      errors.push(message);
    } else {
      warnings.push(`${message} AI build generation will be unavailable.`);
    }
  }

  const weakSecrets = ["password", "secret", "changeme", "123456", "admin"];
  const secretKeys = ["secret", "key", "jwt", "cookie"];
  Object.entries(config).forEach(([key, value]) => {
    if (typeof value === "string" && value.length < 32) {
      if (secretKeys.some((sk) => key.toLowerCase().includes(sk))) {
        if (weakSecrets.some((weak) => value.toLowerCase().includes(weak))) {
          warnings.push(
            `Weak secret detected for ${key}. Use a strong, randomly generated value.`,
          );
        } else if (isProduction) {
          warnings.push(
            `${key} is only ${value.length} characters. Recommended: 32+ characters for production.`,
          );
        }
      }
    }
  });

  if (
    isProduction &&
    !config.VERCEL_TOKEN &&
    !config.NETLIFY_AUTH_TOKEN &&
    !config.FLY_API_TOKEN
  ) {
    warnings.push(
      "No deploy provider configured (VERCEL_TOKEN / NETLIFY_AUTH_TOKEN / FLY_API_TOKEN). ZIP + live preview still work.",
    );
  }
  if (
    isProduction &&
    !config.APP_URL &&
    !config.PUBLIC_APP_URL &&
    !config.CORS_ORIGIN
  ) {
    warnings.push(
      "APP_URL, PUBLIC_APP_URL or CORS_ORIGIN recommended for signed live-preview and redirect links.",
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateEnvOrThrow(
  config: Partial<EnvConfig> = process.env as any,
): void {
  const result = validateEnv(config);
  if (!result.valid) {
    console.error("❌ Environment validation failed:");
    result.errors.forEach((e) => console.error(`  - ${e}`));
    throw new Error("Environment validation failed");
  }
  if (result.warnings.length > 0 && config.NODE_ENV === "production") {
    console.warn("⚠️ Environment warnings in production:");
    result.warnings.forEach((w) => console.warn(`  - ${w}`));
  }
}

export function getEnvSummary(
  config: Partial<EnvConfig> = process.env as any,
): string {
  const billingCatalogReady = REQUIRED_BILLING_PRICE_KEYS.every(
    (key) => !!config[key],
  );
  const authReady = Boolean(
    (config.VITE_SUPABASE_URL || config.SUPABASE_URL) &&
    (config.SUPABASE_SERVICE_ROLE_KEY ||
      config.VITE_SUPABASE_PUBLISHABLE_KEY ||
      config.VITE_SUPABASE_ANON_KEY ||
      config.SUPABASE_ANON_KEY),
  );

  return [
    "Environment Configuration:",
    `  NODE_ENV: ${config.NODE_ENV || "❌ Not set"}`,
    `  Database: ${config.DATABASE_URL || config.SUPABASE_DB_URL ? "✅" : "❌"}`,
    `  Supabase Auth: ${authReady ? "✅" : "❌"}`,
    `  Auth Secrets: ${config.JWT_SECRET && config.COOKIE_SECRET ? "✅" : "❌"}`,
    `  Supabase Service Role: ${config.SUPABASE_SERVICE_ROLE_KEY ? "✅" : "⚠️"}`,
    `  Stripe: ${config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET ? "✅" : "❌"}`,
    `  Stripe Billing Catalog: ${billingCatalogReady ? "✅" : "❌"}`,
    `  Owner Email: ${config.OWNER_EMAIL ? "✅" : "❌ (required for admin)"}`,
    `  hCaptcha: ${config.HCAPTCHA_SECRET ? "✅" : "⚠️"}`,
    `  Twilio SMS: ${config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN ? "✅" : "⚠️"}`,
    `  Vanta: ${config.VANTA_WORKSPACE_ID && config.VANTA_API_TOKEN ? "✅" : "⚠️"}`,
    `  Resend Email: ${config.RESEND_API_KEY ? "✅" : "⚠️"}`,
    `  Vercel Deploy: ${config.VERCEL_TOKEN ? "✅" : "⚠️"}`,
    `  LLM Provider: ${llmReady(config) ? "✅" : "❌ (at least one supported provider required)"}`,
    `  Redis: ${config.REDIS_URL ? "✅" : isProductionSummary(config) ? "❌ (required for multi-machine production)" : "⚠️"}`,
    `  Sentry: ${config.SENTRY_DSN ? "✅" : "⚠️"}`,
    `  CORS: ${config.CORS_ORIGIN ? "✅" : "⚠️"}`,
    `  GitHub OAuth: ${config.GITHUB_CLIENT_ID ? "✅" : "⚠️"}`,
    `  Request Timeout: ${config.REQUEST_TIMEOUT_MS ? "✅" : "⚠️ (defaulting to 330s)"}`,
  ].join("\n");
}

function isProductionSummary(config: Partial<EnvConfig>): boolean {
  return config.NODE_ENV === "production";
}

export default { validateEnv, validateEnvOrThrow, getEnvSummary };
