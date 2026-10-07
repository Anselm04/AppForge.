import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { ENV } from "../_core/env.js";

const LOGIN_MFA_COOKIE = "appforge_login_mfa";
const LOGIN_MFA_TTL_MS = 12 * 60 * 60 * 1000;

export const loginMfaCodeSchema = z.string().regex(/^[0-9]{6}$/);

type LoginMfaPayload = {
  v: 1;
  uid: string;
  ua: string;
  iat: number;
  exp: number;
};

function signingSecret(): string {
  if (!ENV.cookieSecret) {
    throw new Error("Login verification signing secret is not configured");
  }
  return ENV.cookieSecret;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(value: string): string {
  return createHmac("sha256", signingSecret())
    .update(`appforge-login-mfa:v1:${value}`)
    .digest("hex");
}

function userAgentFingerprint(req: Request): string {
  return sha256(String(req.headers["user-agent"] ?? ""));
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "strict" as const,
    path: "/",
  };
}

function encodePayload(payload: LoginMfaPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): LoginMfaPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<LoginMfaPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.uid !== "string" ||
      parsed.uid.length === 0 ||
      typeof parsed.ua !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    return parsed as LoginMfaPayload;
  } catch {
    return null;
  }
}

export function setLoginMfaCookie(
  req: Request,
  res: Response,
  supabaseUid: string,
): void {
  if (!supabaseUid) throw new Error("Primary identity is required");
  const now = Date.now();
  const encoded = encodePayload({
    v: 1,
    uid: supabaseUid,
    ua: userAgentFingerprint(req),
    iat: now,
    exp: now + LOGIN_MFA_TTL_MS,
  });
  res.cookie(LOGIN_MFA_COOKIE, `${encoded}.${hmac(encoded)}`, {
    ...cookieOptions(),
    maxAge: LOGIN_MFA_TTL_MS,
  });
}

export function clearLoginMfaCookie(res: Response): void {
  res.clearCookie(LOGIN_MFA_COOKIE, cookieOptions());
}

export function hasValidLoginMfa(req: Request, supabaseUid: string): boolean {
  const raw = req.cookies?.[LOGIN_MFA_COOKIE];
  if (typeof raw !== "string" || raw.length === 0 || !supabaseUid) return false;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return false;
  const encoded = raw.slice(0, dot);
  const suppliedSignature = raw.slice(dot + 1);

  let expectedSignature: string;
  try {
    expectedSignature = hmac(encoded);
  } catch {
    return false;
  }

  const supplied = Buffer.from(suppliedSignature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (
    supplied.length === 0 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return false;
  }

  const payload = decodePayload(encoded);
  if (
    !payload ||
    payload.uid !== supabaseUid ||
    payload.exp <= Date.now() ||
    payload.ua !== userAgentFingerprint(req)
  ) {
    return false;
  }

  return true;
}

export function loginMfaExpiresInSeconds(): number {
  return Math.floor(LOGIN_MFA_TTL_MS / 1000);
}
