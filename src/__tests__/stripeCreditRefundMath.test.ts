import { describe, expect, it } from "vitest";
import { calculateCreditRefundAdjustment } from "../services/stripeCreditRefundMath.js";

describe("Stripe credit refund arithmetic", () => {
  it("calculates the first partial refund proportionally", () => {
    expect(
      calculateCreditRefundAdjustment({
        originalCredits: 100,
        chargeAmount: 10000,
        amountRefunded: 2500,
        fullyRefunded: false,
        accountedCredits: 0,
      }),
    ).toEqual({ targetCredits: 25, delta: 25 });
  });

  it("reconciles only the new delta for cumulative partial refunds", () => {
    expect(
      calculateCreditRefundAdjustment({
        originalCredits: 100,
        chargeAmount: 10000,
        amountRefunded: 5000,
        fullyRefunded: false,
        accountedCredits: 25,
      }),
    ).toEqual({ targetCredits: 50, delta: 25 });
  });

  it("rounds partial refunds down to whole credits", () => {
    expect(
      calculateCreditRefundAdjustment({
        originalCredits: 50,
        chargeAmount: 4900,
        amountRefunded: 1000,
        fullyRefunded: false,
        accountedCredits: 0,
      }),
    ).toEqual({ targetCredits: 10, delta: 10 });
  });

  it("targets the entire original pack on a full refund", () => {
    expect(
      calculateCreditRefundAdjustment({
        originalCredits: 250,
        chargeAmount: 19900,
        amountRefunded: 19900,
        fullyRefunded: true,
        accountedCredits: 80,
      }),
    ).toEqual({ targetCredits: 250, delta: 170 });
  });

  it("returns zero delta when the cumulative refund has already been accounted", () => {
    expect(
      calculateCreditRefundAdjustment({
        originalCredits: 100,
        chargeAmount: 10000,
        amountRefunded: 5000,
        fullyRefunded: false,
        accountedCredits: 50,
      }),
    ).toEqual({ targetCredits: 50, delta: 0 });
  });

  it("rejects invalid refund amounts and invalid persisted accounting", () => {
    expect(() =>
      calculateCreditRefundAdjustment({
        originalCredits: 100,
        chargeAmount: 0,
        amountRefunded: 0,
        fullyRefunded: false,
        accountedCredits: 0,
      }),
    ).toThrow("Invalid Stripe refund amounts");

    expect(() =>
      calculateCreditRefundAdjustment({
        originalCredits: 100,
        chargeAmount: 10000,
        amountRefunded: 10001,
        fullyRefunded: false,
        accountedCredits: 0,
      }),
    ).toThrow("Invalid Stripe refund amounts");

    expect(() =>
      calculateCreditRefundAdjustment({
        originalCredits: 100,
        chargeAmount: 10000,
        amountRefunded: 5000,
        fullyRefunded: false,
        accountedCredits: 101,
      }),
    ).toThrow("Invalid accounted refund credits");
  });
});
