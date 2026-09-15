import { describe, expect, it } from "vitest";
import {
  LIVE_APP_ORIGIN,
  allowedCorsOrigins,
  normalizeCorsOrigin,
} from "./corsOrigin.js";

describe("normalizeCorsOrigin", () => {
  it("accepts HTTPS and strips path/query details", () => {
    expect(
      normalizeCorsOrigin("https://example.com/path?q=1", true),
    ).toBe("https://example.com");
  });

  it("rejects HTTP when HTTPS is required", () => {
    expect(normalizeCorsOrigin("http://example.com", true)).toBeNull();
  });

  it("allows HTTP only for non-production development use", () => {
    expect(normalizeCorsOrigin("http://localhost:5173/app", false)).toBe(
      "http://localhost:5173",
    );
  });

  it("rejects non-web and malformed origins", () => {
    expect(normalizeCorsOrigin("javascript:alert(1)", false)).toBeNull();
    expect(normalizeCorsOrigin("not a url", false)).toBeNull();
  });
});

describe("allowedCorsOrigins", () => {
  it("fails closed on insecure configured production origins", () => {
    const allowed = allowedCorsOrigins(
      true,
      "http://insecure.example.com,https://secure.example.com",
    );

    expect(allowed.has("http://insecure.example.com")).toBe(false);
    expect(allowed.has("https://secure.example.com")).toBe(true);
    expect(allowed.has(LIVE_APP_ORIGIN)).toBe(true);
  });

  it("includes local development origins only outside production", () => {
    const production = allowedCorsOrigins(true, "");
    const development = allowedCorsOrigins(false, "");

    expect(production.has("http://localhost:5173")).toBe(false);
    expect(development.has("http://localhost:5173")).toBe(true);
  });
});
