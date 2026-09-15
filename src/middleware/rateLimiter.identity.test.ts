import { describe, expect, it } from "vitest";
import { rateLimitIdentity } from "./rateLimiter.js";
import { slowDownIdentity } from "./slowDown.js";

type FakeRequest = {
  user?: { id?: number };
  headers?: Record<string, string>;
  ip?: string;
  socket?: { remoteAddress?: string };
};

function request(overrides: FakeRequest = {}): FakeRequest {
  return {
    headers: {},
    ip: "203.0.113.10",
    socket: { remoteAddress: "203.0.113.11" },
    ...overrides,
  };
}

describe("trusted abuse-control identities", () => {
  it("uses a server-established AppForge user id when present", () => {
    const req = request({ user: { id: 42 } });

    expect(rateLimitIdentity(req)).toBe("user:42");
    expect(slowDownIdentity(req)).toBe("user:42");
  });

  it("ignores caller-controlled x-user-id and x-api-key headers", () => {
    const req = request({
      headers: {
        "x-user-id": "999999",
        "x-api-key": "attacker-rotated-value",
      },
    });

    expect(rateLimitIdentity(req)).toBe("203.0.113.10");
    expect(slowDownIdentity(req)).toBe("203.0.113.10");
  });

  it("ignores caller-controlled internal-request bypass claims", () => {
    const req = request({
      headers: { "x-internal-request": "true" },
    });

    expect(rateLimitIdentity(req)).toBe("203.0.113.10");
    expect(slowDownIdentity(req)).toBe("203.0.113.10");
  });

  it("falls back to socket address and then unknown", () => {
    const socketOnly = request({ ip: undefined });
    expect(rateLimitIdentity(socketOnly)).toBe("203.0.113.11");
    expect(slowDownIdentity(socketOnly)).toBe("203.0.113.11");

    const noAddress = request({ ip: undefined, socket: {} });
    expect(rateLimitIdentity(noAddress)).toBe("unknown");
    expect(slowDownIdentity(noAddress)).toBe("unknown");
  });
});
