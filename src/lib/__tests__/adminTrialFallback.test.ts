import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ENV } from "../../_core/env.js";
import {
  checkTrialFallback,
  clearTrialFallback,
  issueTrialFallback,
  trialFallbackEnabled,
} from "../adminTrialFallback.js";
const original = { production: ENV.isProduction, secret: ENV.cookieSecret };
function context(token = "owner-token", ua = "browser") {
  const req = {
    headers: { authorization: `Bearer ${token}`, "user-agent": ua },
    cookies: {},
  } as unknown as Request;
  const res = {
    cookie: vi.fn((key, value) => {
      req.cookies[key] = value;
    }),
    clearCookie: vi.fn((key) => {
      delete req.cookies[key];
    }),
  } as unknown as Response;
  return { req, res };
}
beforeEach(() => {
  ENV.isProduction = true;
  ENV.cookieSecret = "private-test-signing-key".padEnd(40, "x");
  vi.stubEnv("ADMIN_MFA_TRIAL_FALLBACK", "true");
  vi.stubEnv(
    "ADMIN_MFA_TRIAL_FALLBACK_UNTIL",
    new Date(Date.now() + 3600000).toISOString(),
  );
});
afterEach(() => {
  ENV.isProduction = original.production;
  ENV.cookieSecret = original.secret;
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("temporary owner trial challenge", () => {
  it("issues a random six-digit code bound to owner and browser and consumes it", () => {
    const { req, res } = context();
    const code = issueTrialFallback(req, res, 7);
    expect(code).toMatch(/^\d{6}$/);
    expect(checkTrialFallback(req, 7, code)).toBe(true);
    expect(checkTrialFallback(req, 8, code)).toBe(false);
    expect(
      checkTrialFallback(req, 7, code === "111111" ? "222222" : "111111"),
    ).toBe(false);
    const other = context("different-owner-session");
    other.req.cookies = { ...req.cookies };
    expect(checkTrialFallback(other.req, 7, code)).toBe(false);
    const browser = context("owner-token", "different-browser");
    browser.req.cookies = { ...req.cookies };
    expect(checkTrialFallback(browser.req, 7, code)).toBe(false);
    expect(JSON.stringify(req.cookies)).not.toContain(code);
    clearTrialFallback(res);
    expect(checkTrialFallback(req, 7, code)).toBeNull();
  });
  it("rejects tampered cookies", () => {
    const { req, res } = context();
    const code = issueTrialFallback(req, res, 7);
    req.cookies.appforge_admin_trial += "ab";
    expect(checkTrialFallback(req, 7, code)).toBe(false);
  });
  it("expires challenges after five minutes", () => {
    vi.useFakeTimers();
    const { req, res } = context();
    const code = issueTrialFallback(req, res, 7);
    vi.advanceTimersByTime(300001);
    expect(checkTrialFallback(req, 7, code)).toBe(false);
  });
  it("requires explicit production activation and a future deadline", () => {
    vi.stubEnv("ADMIN_MFA_TRIAL_FALLBACK", "false");
    expect(trialFallbackEnabled()).toBe(false);
    vi.stubEnv("ADMIN_MFA_TRIAL_FALLBACK", "true");
    vi.stubEnv("ADMIN_MFA_TRIAL_FALLBACK_UNTIL", "2000-01-01T00:00:00Z");
    expect(trialFallbackEnabled()).toBe(false);
  });
  it("disables existing challenges when recovery is switched off", () => {
    const { req, res } = context();
    const code = issueTrialFallback(req, res, 7);
    vi.stubEnv("ADMIN_MFA_TRIAL_FALLBACK", "false");
    expect(checkTrialFallback(req, 7, code)).toBe(false);
  });
});
