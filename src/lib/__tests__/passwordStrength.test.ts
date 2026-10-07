import { describe, expect, it } from "vitest";
import {
  evaluatePasswordStrength,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
} from "../passwordStrength.js";

describe("password strength policy", () => {
  it("enforces the same minimum length as the signup API", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(evaluatePasswordStrength("short12").meetsMinimum).toBe(false);
    expect(evaluatePasswordStrength("longenough1").meetsMinimum).toBe(true);
  });

  it("scores each advisory check independently", () => {
    expect(evaluatePasswordStrength("").passed).toEqual([]);
    expect(evaluatePasswordStrength("abcdefgh").passed).toEqual(["length"]);
    expect(evaluatePasswordStrength("abcdefg1").passed).toEqual([
      "length",
      "number",
    ]);
    expect(evaluatePasswordStrength("Abcdefg1").passed).toEqual([
      "length",
      "mixed",
      "number",
    ]);
    expect(evaluatePasswordStrength("Abcdefg1!").passed).toEqual([
      "length",
      "mixed",
      "number",
      "symbol",
    ]);
  });

  it("maps the score onto a human strength level", () => {
    expect(evaluatePasswordStrength("a").level).toBe("weak");
    expect(evaluatePasswordStrength("abcdefgh").level).toBe("weak");
    expect(evaluatePasswordStrength("abcdefg1").level).toBe("fair");
    expect(evaluatePasswordStrength("Abcdefg1").level).toBe("good");
    expect(evaluatePasswordStrength("Abcdefg1!").level).toBe("strong");
  });
});

describe("email shape validation", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("owner@appforge.dev")).toBe(true);
    expect(isValidEmail("  anselm.perkins@gmail.com  ")).toBe(true);
  });

  it("rejects values that cannot be a real address", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("nope@")).toBe(false);
    expect(isValidEmail("nope@site")).toBe(false);
    expect(isValidEmail("two words@site.com")).toBe(false);
  });
});
