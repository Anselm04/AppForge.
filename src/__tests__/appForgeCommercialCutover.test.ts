import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertCommercialCheckoutReady } from "../services/appForgeCommercialCheckoutGate.js";

afterEach(() => vi.unstubAllEnvs());

describe("approved commercial checkout uses live deliverability, not a permanent stop", () => {
  it("accepts local payment simulations without charging Stripe", async () => {
    await expect(assertCommercialCheckoutReady("test")).resolves.toBeUndefined();
    await expect(assertCommercialCheckoutReady("development")).resolves.toBeUndefined();
  });

  it("never creates a production paid checkout when required price evidence is absent", async () => {
    vi.stubEnv("APPFORGE_LLM_RUNTIME_MAX_CENTS", "");
    await expect(assertCommercialCheckoutReady("production")).rejects.toThrow(
      /priced|reviewed|ceiling|needed/i,
    );
  });

  it("runs the customer build/price preflight before Stripe session creation", () => {
    const gate = readFileSync(
      resolve(process.cwd(), "src/services/appForgeCommercialCheckoutGate.ts"),
      "utf8",
    );
    expect(gate).toContain("assertBuildExecutionReady()");
    expect(gate).toContain("assertCustomerComputeLaunchCertified(false, environment)");
    const checkout = readFileSync(
      resolve(process.cwd(), "src/services/stripeCheckout.ts"),
      "utf8",
    );
    for (const section of [
      checkout.slice(
        checkout.indexOf("export async function createPlanCheckout("),
        checkout.indexOf("export async function createCreditCheckout("),
      ),
      checkout.slice(checkout.indexOf("export async function createCreditCheckout(")),
    ]) {
      expect(section.indexOf("await assertCommercialCheckoutReady()")).toBeGreaterThan(0);
      expect(section.indexOf("await assertCommercialCheckoutReady()")).toBeLessThan(
        section.indexOf("getStripe()"),
      );
    }
  });
});
