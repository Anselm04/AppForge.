import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { verifyAppForgeStripeAccount } from "../services/appForgeStripe.js";

afterEach(() => vi.unstubAllEnvs());
function client(accountId: string) {
  const retrieve = vi.fn().mockResolvedValue({ id: accountId });
  return { stripe: { accounts: { retrieve } } as unknown as Stripe, retrieve };
}
describe("AppForge payment account isolation", () => {
  it("rejects missing dedicated-account configuration before contacting Stripe", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APPFORGE_STRIPE_ACCOUNT_ID", "");
    const { stripe, retrieve } = client("acct_shared");
    await expect(verifyAppForgeStripeAccount(stripe)).rejects.toThrow(
      "not configured",
    );
    expect(retrieve).not.toHaveBeenCalled();
  });
  it("rejects website or marketing credentials even with valid Stripe keys", async () => {
    vi.stubEnv("APPFORGE_STRIPE_ACCOUNT_ID", "acct_appforge");
    await expect(
      verifyAppForgeStripeAccount(client("acct_website").stripe),
    ).rejects.toThrow("do not belong");
  });
  it("accepts only the configured AppForge account", async () => {
    vi.stubEnv("APPFORGE_STRIPE_ACCOUNT_ID", "acct_appforge");
    await expect(
      verifyAppForgeStripeAccount(client("acct_appforge").stripe),
    ).resolves.toBeUndefined();
  });
  it("fails closed on provider errors", async () => {
    vi.stubEnv("APPFORGE_STRIPE_ACCOUNT_ID", "acct_appforge");
    const { stripe, retrieve } = client("acct_appforge");
    retrieve.mockRejectedValue(new Error("Stripe unavailable"));
    await expect(verifyAppForgeStripeAccount(stripe)).rejects.toThrow(
      "Stripe unavailable",
    );
  });
});
