import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ENV } from "../../_core/env.js";
import {
  clearAdminMfaCookie,
  hasValidAdminMfa,
  setAdminMfaCookie,
} from "../adminMfa.js";

type CookieCapture = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function request(token = "primary-token", userAgent = "test-browser"): Request {
  return {
    headers: {
      authorization: `Bearer ${token}`,
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

  it("expires the admin MFA session after its short lifetime", () => {
    const req = request();
    const { res, cookies } = responseCapture();
    setAdminMfaCookie(req, res, 42);
    req.cookies = { [cookies[0].name]: cookies[0].value };

    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(hasValidAdminMfa(req, 42)).toBe(false);
  });

  it("clears the dedicated MFA cookie on sign out", () => {
    const { res, cleared } = responseCapture();
    clearAdminMfaCookie(res);
    expect(cleared).toHaveLength(1);
    expect(cleared[0].name).toBe("appforge_admin_mfa");
  });
});
