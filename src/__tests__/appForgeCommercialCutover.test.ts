import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertCommercialCheckoutReleased,
  COMMERCIAL_CHECKOUT_PAUSED,
} from "../services/appForgeCommercialCheckoutGate.js";

describe("approved prices do not automatically activate live billing", () => {
  it("refuses new paid sessions in production until full commercial signoff", () => {
    expect(() => assertCommercialCheckoutReleased("production")).toThrow(
      COMMERCIAL_CHECKOUT_PAUSED,
    );
  });

  it("permits zero-cost simulated Stripe tests", () => {
    expect(() => assertCommercialCheckoutReleased("test")).not.toThrow();
    expect(() => assertCommercialCheckoutReleased("development")).not.toThrow();
  });

  it("checks the release gate before connecting to Stripe", () => {
    const checkout = readFileSync(
      resolve(process.cwd(), "src/services/stripeCheckout.ts"),
      "utf8",
    );
    const plan = checkout.slice(
      checkout.indexOf("export async function createPlanCheckout("),
      checkout.indexOf("export async function createCreditCheckout("),
    );
    const credits = checkout.slice(
      checkout.indexOf("export async function createCreditCheckout("),
    );
    for (const operation of [plan, credits]) {
      expect(operation.indexOf("assertCommercialCheckoutReleased()"))
        .toBeGreaterThan(0);
      expect(operation.indexOf("assertCommercialCheckoutReleased()"))
        .toBeLessThan(operation.indexOf("getStripe()"));
    }
  });
});
