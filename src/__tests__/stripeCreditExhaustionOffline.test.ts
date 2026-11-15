import { describe, expect, it } from "vitest";
import { assertSufficientCreditBalance } from "../lib/creditDeductionPolicy.js";

describe("customer credit exhaustion safety", () => {
  it("blocks a build when the prepaid balance is zero", () => {
    expect(() => assertSufficientCreditBalance(0, 1)).toThrow(
      "Insufficient credits: need 1, have 0",
    );
  });

  it("blocks overdraw without allowing a negative credit balance", () => {
    expect(() => assertSufficientCreditBalance(3, 4)).toThrow(
      "Insufficient credits: need 4, have 3",
    );
  });

  it("permits exact balance spend and rejects malformed amounts", () => {
    expect(() => assertSufficientCreditBalance(3, 3)).not.toThrow();
    for (const amount of [0, -1, 0.1, Number.NaN]) {
      expect(() => assertSufficientCreditBalance(3, amount)).toThrow(
        /positive integer/,
      );
    }
  });

  it("rejects corrupt balance values instead of minting negative credits", () => {
    for (const balance of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertSufficientCreditBalance(balance, 1)).toThrow(
        "Invalid credit balance",
      );
    }
  });
});
