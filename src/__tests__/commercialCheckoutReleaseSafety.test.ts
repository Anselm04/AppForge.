import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertCommercialCheckoutReleased,
  COMMERCIAL_CHECKOUT_PAUSED,
} from "../services/appForgeCommercialCheckoutGate.js";

describe("AppForge commercial release gate", () => {
  it("denies paid checkout outside explicitly allowed local test environments", () => {
    for (const runtime of ["production", "preview", "staging", "qa", "", "Production"]) {
      expect(() => assertCommercialCheckoutReleased(runtime)).toThrow(
        COMMERCIAL_CHECKOUT_PAUSED,
      );
    }
  });

  it("allows mocked test and development checkouts without opening live billing", () => {
    expect(() => assertCommercialCheckoutReleased("test")).not.toThrow();
    expect(() => assertCommercialCheckoutReleased("development")).not.toThrow();
  });

  it("checks both subscription and credit checkout before contacting Stripe", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/services/stripeCheckout.ts"),
      "utf8",
    );
    for (const method of [
      "export async function createPlanCheckout(",
      "export async function createCreditCheckout(",
    ]) {
      const from = source.indexOf(method);
      expect(from).toBeGreaterThanOrEqual(0);
      const block = source.slice(from, source.indexOf("const session =", from));
      expect(block).toContain("assertCommercialCheckoutReleased()");
      expect(block.indexOf("assertCommercialCheckoutReleased()")).toBeLessThan(
        block.indexOf("const stripe = await getStripe()"),
      );
    }
  });
});
