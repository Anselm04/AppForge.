import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getRateLimitConfig, rateLimitIdentity } from "./rateLimiter";

describe("rateLimitIdentity", () => {
  it("prefers the trusted authenticated user identity", () => {
    const identity = rateLimitIdentity({
      user: { id: 42 },
      headers: { "x-api-key": "should-not-win" },
      ip: "203.0.113.10",
      socket: {},
    });

    expect(identity).toBe("user:42");
  });

  it("hashes API keys instead of exposing credentials in limiter storage", () => {
    const apiKey = "appforge-secret-key";
    const digest = createHash("sha256").update(apiKey).digest("hex");
    const identity = rateLimitIdentity({
      headers: { "x-api-key": apiKey },
      ip: "203.0.113.11",
      socket: {},
    });

    expect(identity).toBe(`api-key-sha256:${digest}`);
    expect(identity).not.toContain(apiKey);
  });

  it("falls back to request IP, socket address, then unknown", () => {
    expect(
      rateLimitIdentity({
        headers: {},
        ip: "203.0.113.12",
        socket: { remoteAddress: "10.0.0.1" },
      }),
    ).toBe("203.0.113.12");

    expect(
      rateLimitIdentity({ headers: {}, socket: { remoteAddress: "10.0.0.2" } }),
    ).toBe("10.0.0.2");

    expect(rateLimitIdentity({ headers: {}, socket: {} })).toBe("unknown");
  });
});

describe("rate-limit policy", () => {
  it("keeps authentication stricter than normal API traffic", () => {
    const auth = getRateLimitConfig("auth");
    const api = getRateLimitConfig("api");
    const build = getRateLimitConfig("build");

    expect(auth.max).toBeLessThan(api.max);
    expect(build.windowMs).toBeGreaterThan(api.windowMs);
    expect(build.max).toBeLessThan(api.max);
  });
});
