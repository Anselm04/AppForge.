import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { ENV } from "../_core/env.js";

const ADMIN_MFA_COOKIE = "appforge_admin_mfa";
const ADMIN_MFA_TTL_MS = 15 * 60 * 1000;

export const adminMfaCodeSchema = z.string().regex(/^[0-9]{6}$/);

type AdminMfaPayload = {
  v: 1;
  uid: number;
  session: string;
  ua: string;
  iat: number;
  exp: number;
};

function signingSecret(): string {
  const secret = ENV.cookieSecret;
  if (!secret) {
    throw new Error("Admin MFA signing secret is not configured");
  }
  return secret;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(value: string): string {
  return createHmac("sha256", signingSecret())
    .update(`appforge-admin-mfa:v1:${value}`)
    .digest("hex");
}

function readPrimaryAccessToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === "string") {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }
  const cookie = req.cookies?.["sb-access-token"];
  return typeof cookie === "string" && cookie.length > 0 ? cookie : null;
}

function currentSessionFingerprint(req: Request): string | null {
  const token = readPrimaryAccessToken(req);
  return token ? sha256(token) : null;
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
      parsed.v !== 1 ||
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
  const session = currentSessionFingerprint(req);
  if (!session) throw new Error("Primary session is required for admin MFA");

  const now = Date.now();
  const encoded = encodePayload({
    v: 1,
    uid: userId,
    session,
    ua: currentUserAgentFingerprint(req),
    iat: now,
    exp: now + ADMIN_MFA_TTL_MS,
  });
  const signature = hmac(encoded);
  res.cookie(ADMIN_MFA_COOKIE, `${encoded}.${signature}`, {
    ...cookieOptions(),
    maxAge: ADMIN_MFA_TTL_MS,
  });
}

export function clearAdminMfaCookie(res: Response): void {
  res.clearCookie(ADMIN_MFA_COOKIE, cookieOptions());
}

export function hasValidAdminMfa(req: Request, userId: number): boolean {
  const raw = req.cookies?.[ADMIN_MFA_COOKIE];
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
  if (!payload || payload.uid !== userId || payload.exp <= Date.now()) {
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
