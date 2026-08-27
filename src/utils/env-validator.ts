/**
 * Environment Variable Validator
 * Runtime validation for environment variables
 */

export interface EnvConfig {
  NODE_ENV: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_STARTER_PRICE_ID?: string;
  STRIPE_BUILDER_PRICE_ID?: string;
  STRIPE_STUDIO_PRICE_ID?: string;
  STRIPE_ENTERPRISE_PRICE_ID?: string;
  STRIPE_CUSTOM_PRICE_ID?: string;
  STRIPE_STARTER_PAYMENT_LINK?: string;
  STRIPE_BUILDER_PAYMENT_LINK?: string;
  STRIPE_STUDIO_PAYMENT_LINK?: string;
  REDIS_URL?: string;
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  VITE_SENTRY_DSN?: string;
  DATABASE_URL?: string;
  SUPABASE_DB_URL?: string;
  JWT_SECRET?: string;
  COOKIE_SECRET?: string;
  CORS_ORIGIN?: string;
  REQUEST_TIMEOUT_MS?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  COSINE_API_KEY?: string;
  COSINE_API_URL?: string;
  VITE_APP_ID?: string;
  // Admin / Owner
  OWNER_EMAIL?: string;
  OWNER_PHONE?: string;
  OWNER_OPEN_ID?: string;
  // SMS (Twilio)
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  // Captcha
  HCAPTCHA_SECRET?: string;
  // Vanta
  VANTA_WORKSPACE_ID?: string;
  VANTA_API_TOKEN?: string;
  // Email
  RESEND_API_KEY?: string;
  // Vercel
  VERCEL_TOKEN?: string;
  VERCEL_TEAM_ID?: string;
  // LLM
  BUILT_IN_FORGE_API_URL?: string;
  BUILT_IN_FORGE_API_KEY?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnv(
  config: Partial<EnvConfig> = process.env as any,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = config.NODE_ENV === "production";

  // NODE_ENV validation
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

  // Database validation (required)
  if (!config.SUPABASE_URL && !config.DATABASE_URL && !config.SUPABASE_DB_URL) {
    if (isProduction) {
      errors.push(
        "Database connection required: Set SUPABASE_URL, DATABASE_URL, or SUPABASE_DB_URL",
      );
    } else {
      warnings.push("No database connection configured.");
    }
  } else {
    const dbUrl =
      config.SUPABASE_URL || config.DATABASE_URL || config.SUPABASE_DB_URL;
    if (
      dbUrl &&
      !dbUrl.startsWith("postgresql://") &&
      !dbUrl.startsWith("https://")
    ) {
      errors.push(
        "Invalid database URL format. Expected postgresql:// or https://",
      );
    }
  }

  // JWT / Cookie secret validation (required in production)
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

  // Request timeout validation (optional)
  if (config.REQUEST_TIMEOUT_MS) {
    const timeout = parseInt(config.REQUEST_TIMEOUT_MS, 10);
    if (isNaN(timeout) || timeout < 5000 || timeout > 300000) {
      errors.push(
        "REQUEST_TIMEOUT_MS must be a number between 5000 and 300000",
      );
    }
  }

  // CORS origin validation (optional, recommended in production)
  if (isProduction && !config.CORS_ORIGIN) {
    warnings.push(
      "CORS_ORIGIN not set. For production, explicitly set your allowed origin.",
    );
  }

  // Stripe validation (optional)
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

  // Redis validation (optional)
  if (
    config.REDIS_URL &&
    !config.REDIS_URL.startsWith("redis://") &&
    !config.REDIS_URL.startsWith("rediss://")
  ) {
    errors.push("Invalid REDIS_URL format. Expected redis:// or rediss://");
  }

  // Stripe price IDs (optional but needed for paid features)
  if (
    config.STRIPE_SECRET_KEY &&
    (!config.STRIPE_STARTER_PRICE_ID ||
      !config.STRIPE_BUILDER_PRICE_ID ||
      !config.STRIPE_STUDIO_PRICE_ID)
  ) {
    warnings.push(
      "Stripe is configured but one or more STRIPE_*_PRICE_ID is missing. Billing tiers may not work.",
    );
  }
  if (
    config.STRIPE_SECRET_KEY &&
    (!config.STRIPE_STARTER_PAYMENT_LINK ||
      !config.STRIPE_BUILDER_PAYMENT_LINK ||
      !config.STRIPE_STUDIO_PAYMENT_LINK)
  ) {
    warnings.push(
      "Stripe payment links missing. Users cannot use direct checkout without these.",
    );
  }

  // Owner / Admin settings (critical for moderation and god codes)
  if (!config.OWNER_EMAIL) {
    errors.push(
      "OWNER_EMAIL is required. Used for admin dashboard access, ban notifications, and compliance records.",
    );
  }
  if (!config.SUPABASE_SERVICE_ROLE_KEY && isProduction) {
    warnings.push(
      "SUPABASE_SERVICE_ROLE_KEY not set. Auth middleware may fail in production.",
    );
  }

  // Twilio SMS (optional — for god code activation)
  if (config.TWILIO_ACCOUNT_SID && !config.TWILIO_AUTH_TOKEN) {
    warnings.push(
      "TWILIO_ACCOUNT_SID set but TWILIO_AUTH_TOKEN missing. SMS verification will not work.",
    );
  }

  // hCaptcha (optional — bot protection)
  if (!config.HCAPTCHA_SECRET && isProduction) {
    warnings.push(
      "HCAPTCHA_SECRET not set. Project creation has no bot protection in production.",
    );
  }

  // Vanta (optional — compliance sync)
  if (config.VANTA_WORKSPACE_ID && !config.VANTA_API_TOKEN) {
    warnings.push(
      "VANTA_WORKSPACE_ID set but VANTA_API_TOKEN missing. Direct API sync disabled; JSON export still works.",
    );
  }

  // Resend Email (optional)
  if (config.OWNER_EMAIL && !config.RESEND_API_KEY && isProduction) {
    warnings.push(
      "RESEND_API_KEY not set. Email notifications (bans, god codes, welcome) will not be sent.",
    );
  }

  // Vercel (optional — needed for one-click deploy)
  if (!config.VERCEL_TOKEN) {
    warnings.push(
      "VERCEL_TOKEN not set. One-click deployments disabled. ZIP download still works.",
    );
  }

  // LLM / Forge API (required for all AI features)
  if (!config.BUILT_IN_FORGE_API_KEY) {
    if (isProduction) {
      errors.push(
        "BUILT_IN_FORGE_API_KEY is required for AI build generation. Without it, builds cannot run.",
      );
    } else {
      warnings.push(
        "BUILT_IN_FORGE_API_KEY not set. AI build pipeline will fail.",
      );
    }
  }

  // Security warnings
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

  // Deploy destinations
  if (
    isProduction &&
    !config.VERCEL_TOKEN &&
    !(config as any).NETLIFY_AUTH_TOKEN &&
    !(config as any).FLY_API_TOKEN
  ) {
    warnings.push(
      "No deploy provider configured (VERCEL_TOKEN / NETLIFY_AUTH_TOKEN / FLY_API_TOKEN). ZIP + live preview still work.",
    );
  }
  if (isProduction && !(config as any).APP_URL && !config.CORS_ORIGIN) {
    warnings.push(
      "APP_URL or CORS_ORIGIN recommended for signed live-preview links.",
    );
  }

  // Return summary including new variables
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
  return [
    "Environment Configuration:",
    `  NODE_ENV: ${config.NODE_ENV || "❌ Not set"}`,
    `  Database: ${config.DATABASE_URL || config.SUPABASE_URL || config.SUPABASE_DB_URL ? "✅" : "❌"}`,
    `  Auth Secrets: ${config.JWT_SECRET && config.COOKIE_SECRET ? "✅" : "❌"}`,
    `  Supabase Service Role: ${config.SUPABASE_SERVICE_ROLE_KEY ? "✅" : "❌"}`,
    `  Stripe: ${config.STRIPE_SECRET_KEY ? "✅" : "❌"}`,
    `  Stripe Price IDs: ${config.STRIPE_STARTER_PRICE_ID && config.STRIPE_BUILDER_PRICE_ID && config.STRIPE_STUDIO_PRICE_ID ? "✅" : "⚠️"}`,
    `  Owner Email: ${config.OWNER_EMAIL ? "✅" : "❌ (required for admin)"}`,
    `  hCaptcha: ${config.HCAPTCHA_SECRET ? "✅" : "⚠️"}`,
    `  Twilio SMS: ${config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN ? "✅" : "⚠️"}`,
    `  Vanta: ${config.VANTA_WORKSPACE_ID && config.VANTA_API_TOKEN ? "✅" : "⚠️"}`,
    `  Resend Email: ${config.RESEND_API_KEY ? "✅" : "⚠️"}`,
    `  Vercel Deploy: ${config.VERCEL_TOKEN ? "✅" : "⚠️"}`,
    `  LLM (Forge): ${config.BUILT_IN_FORGE_API_KEY ? "✅" : "❌ (required for AI builds)"}`,
    `  Redis: ${config.REDIS_URL ? "✅" : "⚠️"}`,
    `  Sentry: ${config.SENTRY_DSN ? "✅" : "⚠️"}`,
    `  CORS: ${config.CORS_ORIGIN ? "✅" : "⚠️"}`,
    `  GitHub OAuth: ${config.GITHUB_CLIENT_ID ? "✅" : "⚠️"}`,
    `  Request Timeout: ${config.REQUEST_TIMEOUT_MS ? "✅" : "⚠️ (defaulting to 30s)"}`,
  ].join("\n");
}

export default { validateEnv, validateEnvOrThrow, getEnvSummary };
