import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import { ENV } from "../_core/env.js";

const COOKIE = "appforge_admin_trial";
const TTL = 5 * 60 * 1000;
const options = () => ({
  httpOnly: true,
  secure: ENV.isProduction,
  sameSite: "strict" as const,
  path: "/",
});
const digest = (s: string) =>
  createHmac("sha256", ENV.cookieSecret)
    .update(`admin-trial:${s}`)
    .digest("hex");
function session(req: Request): string {
  const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearer || req.cookies?.["sb-access-token"];
  if (typeof token !== "string" || !token)
    throw new Error("Owner login is required");
  return createHash("sha256").update(token).digest("hex");
}
export function trialFallbackEnabled(): boolean {
  if (!ENV.isProduction) return true;
  const until = Date.parse(process.env.ADMIN_MFA_TRIAL_FALLBACK_UNTIL || "");
  return (
    process.env.ADMIN_MFA_TRIAL_FALLBACK === "true" &&
    Number.isFinite(until) &&
    until > Date.now()
  );
}
export function clearTrialFallback(res: Response): void {
  res.clearCookie(COOKIE, options());
}
export function issueTrialFallback(
  req: Request,
  res: Response,
  uid: number,
): string {
  if (!trialFallbackEnabled() || ENV.cookieSecret.length < 32)
    throw new Error("Trial recovery is disabled");
  const code = String(randomInt(100000, 1000000));
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      session: session(req),
      ua: String(req.headers["user-agent"] || ""),
      code: digest(code),
      exp: Date.now() + TTL,
    }),
  ).toString("base64url");
  res.cookie(COOKIE, `${payload}.${digest(payload)}`, {
    ...options(),
    maxAge: TTL,
  });
  return code;
}
export function checkTrialFallback(
  req: Request,
  uid: number,
  code: string,
): boolean | null {
  const raw = req.cookies?.[COOKIE];
  if (typeof raw !== "string") return null;
  if (!trialFallbackEnabled()) return false;
  try {
    const dot = raw.lastIndexOf(".");
    const payload = raw.slice(0, dot);
    const supplied = Buffer.from(raw.slice(dot + 1), "hex");
    const expected = Buffer.from(digest(payload), "hex");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return false;
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      p.uid === uid &&
      p.session === session(req) &&
      p.ua === String(req.headers["user-agent"] || "") &&
      Number.isFinite(p.exp) &&
      p.exp > Date.now() &&
      p.exp <= Date.now() + TTL &&
      typeof p.code === "string" &&
      p.code.length === 64 &&
      timingSafeEqual(Buffer.from(p.code), Buffer.from(digest(code)))
    );
  } catch {
    return false;
  }
}
