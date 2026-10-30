import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ENV } from "../../_core/env.js";
import {
  clearAdminMfaCookie,
  adminMfaCodeSchema,
  hasValidAdminMfa,
  hasValidAdminMfaChallenge,
  setAdminMfaChallengeCookie,
  setAdminMfaCookie,
} from "../adminMfa.js";

type CookieCapture = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

describe("admin SMS code validation", () => {
  it.each(["123456", "000001", "999999"])(
    "accepts six-digit code %s",
    (code) => {
      expect(adminMfaCodeSchema.safeParse(code).success).toBe(true);
    },
  );
  it.each(["12345", "1234567", "abcdef", " 123456", "123456\n", "\\dddddd"])(
    "rejects invalid code %j",
    (code) => {
      expect(adminMfaCodeSchema.safeParse(code).success).toBe(false);
    },
  );
});

function request(token = "primary-token", userAgent = "test-browser"): Request {
  const jwt = `header.${Buffer.from(JSON.stringify({ sub: "owner-identity", session_id: token })).toString("base64url")}.signature`;
  return {
    authAccessToken: jwt,
    headers: {
      authorization: `Bearer ${jwt}`,
      "user-agent": userAgent,
    },
    cookies: {},
  } as unknown as Request;
}

function responseCapture() {
  const cookies: CookieCapture[] = [];
  const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
  const res = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name: string, options: Record<string, unknown>) {
      cleared.push({ name, options });
      return this;
    },
  } as unknown as Response;
  return { res, cookies, cleared };
}

describe("admin MFA session binding", () => {
  const originalSecret = ENV.cookieSecret;
  const originalProduction = ENV.isProduction;

  beforeEach(() => {
    ENV.cookieSecret = "test-cookie-secret-".padEnd(40, "x");
    ENV.isProduction = false;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
  });

  afterEach(() => {
    ENV.cookieSecret = originalSecret;
    ENV.isProduction = originalProduction;
    vi.useRealTimers();
  });

  it("accepts freshly minted MFA cookies for the same primary session and browser ten times", () => {
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      const req = request(`primary-token-${cycle}`);
      const { res, cookies } = responseCapture();

      setAdminMfaCookie(req, res, 42);
      expect(cookies).toHaveLength(1);

      req.cookies = { [cookies[0].name]: cookies[0].value };
      expect(hasValidAdminMfa(req, 42)).toBe(true);
      expect(hasValidAdminMfa(req, 43)).toBe(false);
    }
  });

  it("rejects MFA cookies after a different primary login token ten times", () => {
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      const req = request(`first-session-${cycle}`);
      const { res, cookies } = responseCapture();
      setAdminMfaCookie(req, res, 42);

      const relogin = request(`second-session-${cycle}`);
      relogin.cookies = { [cookies[0].name]: cookies[0].value };
      expect(hasValidAdminMfa(relogin, 42)).toBe(false);
    }
  });

  it("rejects copied MFA cookies from different user agents ten times", () => {
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      const req = request(`session-${cycle}`, `browser-a-${cycle}`);
      const { res, cookies } = responseCapture();
      setAdminMfaCookie(req, res, 42);

      const copied = request(`session-${cycle}`, `browser-b-${cycle}`);
      copied.cookies = { [cookies[0].name]: cookies[0].value };
      expect(hasValidAdminMfa(copied, 42)).toBe(false);
    }
  });

  it("expires the admin MFA session after its short lifetime ten times", () => {
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      const req = request(`expiring-session-${cycle}`);
      const { res, cookies } = responseCapture();
      setAdminMfaCookie(req, res, 42);
      req.cookies = { [cookies[0].name]: cookies[0].value };

      vi.advanceTimersByTime(16 * 60 * 1000);
      expect(hasValidAdminMfa(req, 42)).toBe(false);
      vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    }
  });

  it("clears the dedicated MFA cookie on sign out ten times", () => {
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      const { res, cleared } = responseCapture();
      clearAdminMfaCookie(res);
      expect(cleared).toHaveLength(2);
      expect(cleared[0].name).toBe("appforge_admin_mfa");
    }
  });

  it("keeps MFA valid across access-token rotation in the same verified provider session", () => {
    const req = request("same-session");
    const { res, cookies } = responseCapture();
    setAdminMfaCookie(req, res, 42);
    const rotated = request("same-session");
    rotated.authAccessToken = `${rotated.authAccessToken}.rotated`;
    rotated.headers.authorization = "Bearer expired-raw-token";
    rotated.cookies = { [cookies[0].name]: cookies[0].value };
    expect(hasValidAdminMfa(rotated, 42)).toBe(true);
  });

  it("does not trust an unvalidated token supplied only in a header or cookie", () => {
    const req = request();
    const { res, cookies } = responseCapture();
    setAdminMfaCookie(req, res, 42);
    delete req.authAccessToken;
    req.cookies = { [cookies[0].name]: cookies[0].value };
    expect(hasValidAdminMfa(req, 42)).toBe(false);
    expect(() => setAdminMfaCookie(req, res, 42)).toThrow(/primary session/i);
  });

  it("binds a short-lived admin challenge to the requesting session and purpose", () => {
    const req = request("challenge-session");
    const { res, cookies } = responseCapture();
    setAdminMfaChallengeCookie(req, res, 42);
    req.cookies = {
      [cookies[0].name]: cookies[0].value,
      appforge_admin_mfa: cookies[0].value,
    };
    expect(hasValidAdminMfaChallenge(req, 42)).toBe(true);
    expect(hasValidAdminMfa(req, 42)).toBe(false);
    const other = request("other-session");
    other.cookies = req.cookies;
    expect(hasValidAdminMfaChallenge(other, 42)).toBe(false);
    vi.advanceTimersByTime(6 * 60_000);
    expect(hasValidAdminMfaChallenge(req, 42)).toBe(false);
  });
});
