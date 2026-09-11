import { describe, expect, it } from "vitest";
import { validateEnv } from "../utils/env-validator.js";

const baseProductionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:password@localhost:5432/appforge",
  JWT_SECRET: "j".repeat(40),
  COOKIE_SECRET: "c".repeat(40),
  OWNER_EMAIL: "owner@example.com",
  BUILT_IN_FORGE_API_KEY: "forge_" + "x".repeat(40),
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

  it("does not require obsolete Stripe payment links", () => {
    const result = validateEnv(baseProductionEnv);
    expect(result.errors.join("\n")).not.toContain("PAYMENT_LINK");
    expect(result.warnings.join("\n")).not.toContain("payment links");
  });
});
