import { describe, expect, it } from "vitest";
import {
  parsePositiveIntParam,
  parsePositiveSafeInteger,
} from "../lib/httpParams.js";

describe("parsePositiveIntParam", () => {
  it("accepts canonical positive safe integers", () => {
    expect(parsePositiveIntParam("1")).toBe(1);
    expect(parsePositiveIntParam("42")).toBe(42);
    expect(parsePositiveIntParam(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it.each([
    undefined,
    [],
    ["1"],
    "",
    "0",
    "-1",
    "+1",
    " 1",
    "1 ",
    "01",
    "1.5",
    "1e3",
    "abc",
    String(Number.MAX_SAFE_INTEGER + 1),
  ])("rejects invalid request-boundary value %j", (value) => {
    expect(parsePositiveIntParam(value as string | string[] | undefined)).toBeNull();
  });
});

describe("parsePositiveSafeInteger", () => {
  it("accepts positive safe numeric request ids", () => {
    expect(parsePositiveSafeInteger(1)).toBe(1);
    expect(parsePositiveSafeInteger(42)).toBe(42);
    expect(parsePositiveSafeInteger(Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it.each([
    null,
    undefined,
    true,
    false,
    {},
    [],
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects unsafe numeric/body value %j", (value) => {
    expect(parsePositiveSafeInteger(value)).toBeNull();
  });
});
