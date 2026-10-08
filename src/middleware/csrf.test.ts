import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { csrfProtection } from "./csrf.js";

afterEach(() => vi.unstubAllEnvs());

describe("mutation origin boundary", () => {
  const request = (origin?: string) =>
    ({
      method: "POST",
      signedCookies: { appforge_csrf: "valid-token" },
      get: (name: string) =>
        name === "origin"
          ? origin
          : name === "x-csrf-token"
            ? "valid-token"
            : undefined,
    }) as unknown as Request;

  it("rejects a foreign origin even with a valid token", () => {
    const next = vi.fn();
    csrfProtection(request("https://attacker.example"), {} as Response, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: "EBADCSRFTOKEN" }),
    );
  });

  it("accepts an explicitly configured origin with a valid token", () => {
    vi.stubEnv("CORS_ORIGIN", "https://app.example.com");
    const next = vi.fn();
    csrfProtection(request("https://app.example.com"), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("retains token authentication for non-browser clients", () => {
    const next = vi.fn();
    csrfProtection(request(), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
