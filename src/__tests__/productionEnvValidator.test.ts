import { describe, expect, it } from "vitest";
import { validateEnv } from "../utils/env-validator.js";

const baseProductionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:password@localhost:5432/appforge",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "anon_" + "a".repeat(40),
  JWT_SECRET: "j".repeat(40),
  COOKIE_SECRET: "c".repeat(40),
  OWNER_EMAIL: "owner@example.com",
  BUILT_IN_FORGE_API_KEY: "forge_" + "x".repeat(40),
  REDIS_URL: "rediss://example.invalid:6379",
  STRIPE_SECRET_KEY: "sk_live_" + "x".repeat(40),
  STRIPE_WEBHOOK_SECRET: "whsec_" + "x".repeat(40),
  STRIPE_STARTER_PRICE_ID: "price_starter",
  STRIPE_BUILDER_PRICE_ID: "price_builder",
  STRIPE_STUDIO_PRICE_ID: "price_studio",
  STRIPE_CREDITS_50_PRICE_ID: "price_credits_50",
  STRIPE_CREDITS_100_PRICE_ID: "price_credits_100",
  STRIPE_CREDITS_250_PRICE_ID: "price_credits_250",
  REQUEST_TIMEOUT_MS: "330000",
};

describe("production environment validation", () => {
  it("accepts the deployed 330-second build timeout", () => {
    const result = validateEnv(baseProductionEnv);
    expect(result.errors).not.toContain(
      "REQUEST_TIMEOUT_MS must be a number between 5000 and 360000",
    );
  });

  it("fails production validation when a self-serve billing price is missing", () => {
    const result = validateEnv({
      ...baseProductionEnv,
      STRIPE_CREDITS_250_PRICE_ID: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("STRIPE_CREDITS_250_PRICE_ID");
  });

  it("boots for core sign-up/login/build without Stripe when Redis is configured", () => {
    const {
      STRIPE_SECRET_KEY: _sk,
      STRIPE_WEBHOOK_SECRET: _whsec,
      STRIPE_STARTER_PRICE_ID: _p1,
      STRIPE_BUILDER_PRICE_ID: _p2,
      STRIPE_STUDIO_PRICE_ID: _p3,
      STRIPE_CREDITS_50_PRICE_ID: _p4,
      STRIPE_CREDITS_100_PRICE_ID: _p5,
      STRIPE_CREDITS_250_PRICE_ID: _p6,
      ...coreOnly
    } = baseProductionEnv;
    const result = validateEnv(coreOnly);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails production validation without shared Redis", () => {
    const { REDIS_URL: _redis, ...withoutRedis } = baseProductionEnv;
    const result = validateEnv(withoutRedis);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "REDIS_URL is required in production for shared multi-machine coordination",
    );
  });

  it("requires the Stripe webhook secret only when billing is enabled", () => {
    const result = validateEnv({
      ...baseProductionEnv,
      STRIPE_WEBHOOK_SECRET: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("does not require obsolete Stripe payment links", () => {
    const result = validateEnv(baseProductionEnv);
    expect(result.errors.join("\n")).not.toContain("PAYMENT_LINK");
    expect(result.warnings.join("\n")).not.toContain("payment links");
  });

  it("accepts any provider supported by the runtime instead of requiring Forge", () => {
    const { BUILT_IN_FORGE_API_KEY: _forge, ...withoutForge } =
      baseProductionEnv;
    const result = validateEnv({
      ...withoutForge,
      GROQ_API_KEY: "gsk_" + "g".repeat(40),
    });

    expect(result.errors.join("\n")).not.toContain("BUILT_IN_FORGE_API_KEY");
    expect(result.errors.join("\n")).not.toContain("No AI provider configured");
  });

  it("fails production readiness when no supported AI provider exists", () => {
    const { BUILT_IN_FORGE_API_KEY: _forge, ...withoutProvider } =
      baseProductionEnv;
    const result = validateEnv(withoutProvider);

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("No AI provider configured");
  });

  it.each([
    ["DEEPSEEK_API_KEY", "deepseek-key"],
    ["GEMINI_API_KEY", "gemini-key"],
    ["OPENROUTER_API_KEY", "openrouter-key"],
    ["OPENAI_API_KEY", "openai-key"],
    ["OPENAI_COMPAT_BASE_URL", "https://llm.example.com"],
  ] as const)("recognizes %s as an AI provider source", (key, value) => {
    const { BUILT_IN_FORGE_API_KEY: _forge, ...withoutForge } =
      baseProductionEnv;
    const result = validateEnv({ ...withoutForge, [key]: value });
    expect(result.errors.join("\n")).not.toContain("No AI provider configured");
  });
});
