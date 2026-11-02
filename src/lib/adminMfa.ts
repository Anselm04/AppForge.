import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { ENV } from "../_core/env.js";

const ADMIN_MFA_COOKIE = "appforge_admin_mfa";
const ADMIN_CHALLENGE_COOKIE = "appforge_admin_challenge";
const ADMIN_MFA_TTL_MS = 15 * 60 * 1000;
const ADMIN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const adminMfaCodeSchema = z.string().regex(/^[0-9]{6}$/);

type AdminMfaPayload = {
  v: 2;
  purpose: "verified" | "challenge";
  uid: number;
  session: string;
  ua: string;
  iat: number;
  exp: number;
  fallbackCodeHash?: string;
};

function signingSecret(): string {
  const secret = ENV.cookieSecret;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Admin MFA signing secret must contain at least 32 characters",
    );
  }
  return secret;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(value: string): string {
  return createHmac("sha256", signingSecret())
    .update(`appforge-admin-mfa:v2:${value}`)
    .digest("hex");
}

function currentSessionFingerprint(req: Request): string | null {
  // Only use the token validated by authentication middleware. Raw headers and
  // cookies can contain expired tokens replaced during server-side refresh.
  const token = req.authAccessToken;
  if (!token) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    ) as { sub?: string; session_id?: string };
    if (
      typeof claims.sub !== "string" ||
      !claims.sub ||
      typeof claims.session_id !== "string" ||
      !claims.session_id
    )
      return null;
    return sha256(JSON.stringify([claims.sub, claims.session_id]));
  } catch {
    return null;
  }
}

function currentUserAgentFingerprint(req: Request): string {
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

function encodePayload(payload: AdminMfaPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encoded: string): AdminMfaPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<AdminMfaPayload>;
    if (
      parsed.v !== 2 ||
      !["verified", "challenge"].includes(parsed.purpose ?? "") ||
      !Number.isInteger(parsed.uid) ||
      typeof parsed.session !== "string" ||
      typeof parsed.ua !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    return parsed as AdminMfaPayload;
  } catch {
    return null;
  }
}

export function setAdminMfaCookie(
  req: Request,
  res: Response,
  userId: number,
): void {
  setMfaCookie(req, res, userId, "verified");
  res.clearCookie(ADMIN_CHALLENGE_COOKIE, cookieOptions());
}

export function setAdminMfaChallengeCookie(
  req: Request,
  res: Response,
  userId: number,
): void {
  setMfaCookie(req, res, userId, "challenge");
}

// Owner-authorized testing bypass is explicitly activated and time bounded.
export function adminMfaTrialFallbackEnabled(): boolean {
  if (!ENV.isProduction) return true;
  const until = Date.parse(process.env.ADMIN_MFA_TRIAL_FALLBACK_UNTIL || "");
  return (
    process.env.ADMIN_MFA_TRIAL_FALLBACK === "true" &&
    Number.isFinite(until) &&
    until > Date.now()
  );
}

export function setAdminMfaFallbackChallenge(
  req: Request,
  res: Response,
  userId: number,
  code: string,
): void {
  setMfaCookie(req, res, userId, "challenge", hmac(`fallback-code:${code}`));
}

export function checkAdminMfaFallbackCode(
  req: Request,
  userId: number,
  code: string,
): boolean | null {
  if (!hasValidAdminMfaChallenge(req, userId)) return null;
  const raw = req.cookies[ADMIN_CHALLENGE_COOKIE] as string;
  const payload = decodePayload(raw.slice(0, raw.lastIndexOf(".")));
  if (!payload?.fallbackCodeHash) return null;
  return (
    adminMfaTrialFallbackEnabled() &&
    timingSafeEqual(
      Buffer.from(hmac(`fallback-code:${code}`)),
      Buffer.from(payload.fallbackCodeHash),
    )
  );
}

function setMfaCookie(
  req: Request,
  res: Response,
  userId: number,
  purpose: AdminMfaPayload["purpose"],
  fallbackCodeHash?: string,
): void {
  const session = currentSessionFingerprint(req);
  if (!session) throw new Error("Primary session is required for admin MFA");

  const now = Date.now();
  const encoded = encodePayload({
    v: 2,
    purpose,
    uid: userId,
    ...(fallbackCodeHash ? { fallbackCodeHash } : {}),
    session,
    ua: currentUserAgentFingerprint(req),
    iat: now,
    exp:
      now +
      (purpose === "verified" ? ADMIN_MFA_TTL_MS : ADMIN_CHALLENGE_TTL_MS),
  });
  const signature = hmac(encoded);
  res.cookie(
    purpose === "verified" ? ADMIN_MFA_COOKIE : ADMIN_CHALLENGE_COOKIE,
    `${encoded}.${signature}`,
    {
      ...cookieOptions(),
      maxAge:
        purpose === "verified" ? ADMIN_MFA_TTL_MS : ADMIN_CHALLENGE_TTL_MS,
    },
  );
}

export function clearAdminMfaCookie(res: Response): void {
  res.clearCookie(ADMIN_MFA_COOKIE, cookieOptions());
  res.clearCookie(ADMIN_CHALLENGE_COOKIE, cookieOptions());
}

export function hasValidAdminMfa(req: Request, userId: number): boolean {
  return hasValidMfaCookie(req, userId, "verified");
}

export function hasValidAdminMfaChallenge(
  req: Request,
  userId: number,
): boolean {
  return hasValidMfaCookie(req, userId, "challenge");
}

function hasValidMfaCookie(
  req: Request,
  userId: number,
  purpose: AdminMfaPayload["purpose"],
): boolean {
  const raw =
    req.cookies?.[
      purpose === "verified" ? ADMIN_MFA_COOKIE : ADMIN_CHALLENGE_COOKIE
    ];
  if (typeof raw !== "string" || raw.length === 0) return false;

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
  const now = Date.now();
  const ttl =
    purpose === "verified" ? ADMIN_MFA_TTL_MS : ADMIN_CHALLENGE_TTL_MS;
  if (
    !payload ||
    payload.purpose !== purpose ||
    payload.uid !== userId ||
    !Number.isFinite(payload.iat) ||
    !Number.isFinite(payload.exp) ||
    payload.iat > now ||
    payload.exp <= now ||
    payload.exp - payload.iat > ttl
  ) {
    return false;
  }

  const session = currentSessionFingerprint(req);
  if (!session || payload.session !== session) return false;
  if (payload.ua !== currentUserAgentFingerprint(req)) return false;

  return true;
}

export function adminMfaExpiresInSeconds(): number {
  return Math.floor(ADMIN_MFA_TTL_MS / 1000);
}
