import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppForgeStripe } from "../services/appForgeStripe.js";

afterEach(() => vi.unstubAllEnvs());

describe("AppForge Stripe configuration", () => {
  it("does not require a dedicated Stripe account id", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_appforge_test_key");
    vi.stubEnv("APPFORGE_STRIPE_ACCOUNT_ID", "");

    await expect(getAppForgeStripe()).resolves.toBeDefined();
  });

  it("requires Stripe credentials when billing is used", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    await expect(getAppForgeStripe()).rejects.toThrow("Stripe not configured");
  });

  it("rejects live Stripe keys outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_never_use_outside_production");

    await expect(getAppForgeStripe()).rejects.toThrow(
      "Live Stripe keys are prohibited outside production",
    );
  });
});
