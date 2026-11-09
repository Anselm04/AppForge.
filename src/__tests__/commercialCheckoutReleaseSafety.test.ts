import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertCommercialCheckoutReady } from "../services/appForgeCommercialCheckoutGate.js";

afterEach(() => vi.unstubAllEnvs());

// prettier-ignore
describe("commercial checkout requires an actual deliverable, not a manual release toggle", () => {
  it("allows local simulated checkout and rejects an unverified runtime", async () => {
    await expect(assertCommercialCheckoutReady("test")).resolves.toBeUndefined();
    await expect(assertCommercialCheckoutReady("development")).resolves.toBeUndefined();
    for (const runtime of ["preview", "staging", "qa", "", "Production"]) {
      await expect(assertCommercialCheckoutReady(runtime)).rejects.toThrow();
    }
  });

  it("checks build readiness before opening a paid Stripe checkout", () => {
    const gate = readFileSync(
      resolve(process.cwd(), "src/services/appForgeCommercialCheckoutGate.ts"),
      "utf8",
    );
    expect(gate).toContain("assertBuildExecutionReady()");
    const source = readFileSync(
      resolve(process.cwd(), "src/services/stripeCheckout.ts"),
      "utf8",
    );
    for (const operation of [
      source.slice(
        source.indexOf("export async function createPlanCheckout("),
        source.indexOf("export async function createCreditCheckout("),
      ),
      source.slice(source.indexOf("export async function createCreditCheckout(")),
    ]) {
      expect(operation.indexOf("await assertCommercialCheckoutReady()")).toBeGreaterThan(0);
      expect(operation.indexOf("await assertCommercialCheckoutReady()")).toBeLessThan(
        operation.indexOf("getStripe()"),
      );
    }
  });
});
