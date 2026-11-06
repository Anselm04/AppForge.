import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertCommercialCheckoutReleased,
  COMMERCIAL_CHECKOUT_PAUSED,
} from "../services/appForgeCommercialCheckoutGate.js";

describe("checkout blocked until new prices are qualified", () => {
  it("fails closed outside explicit local mock environments", () => {
    for (const runtime of [
      "production",
      "preview",
      "staging",
      "qa",
      "",
      "Production",
    ]) {
      expect(() => assertCommercialCheckoutReleased(runtime)).toThrow(
        COMMERCIAL_CHECKOUT_PAUSED,
      );
    }
    expect(() => assertCommercialCheckoutReleased("test")).not.toThrow();
    expect(() => assertCommercialCheckoutReleased("development")).not.toThrow();
  });

  it("guards both payment paths before contacting Stripe", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/services/stripeCheckout.ts"),
      "utf8",
    );
    for (const method of [
      "export async function createPlanCheckout(",
      "export async function createCreditCheckout(",
    ]) {
      const begin = source.indexOf(method);
      expect(begin).toBeGreaterThanOrEqual(0);
      const section = source.slice(
        begin,
        source.indexOf("const session =", begin),
      );
      const stop = section.indexOf("assertCommercialCheckoutReleased()");
      expect(stop).toBeGreaterThanOrEqual(0);
      expect(stop).toBeLessThan(
        section.indexOf("const stripe = await getStripe()"),
      );
    }
  });
});
