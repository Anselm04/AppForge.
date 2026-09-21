import { createHash } from "node:crypto";
import { createClient, type User } from "@supabase/supabase-js";
import { Request, Response, NextFunction } from "express";
import { logger } from "../_core/logger.js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";
const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";
const REFRESH_HEADER = "x-supabase-refresh-token";
const SESSION_PATH = "/api/auth/session";
const PASSWORD_PATH = "/api/auth/password";
const REFRESH_GRACE_MS = 15_000;

type RefreshedSession = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

const refreshFlights = new Map<string, Promise<RefreshedSession | null>>();
const recentRefreshes = new Map<
  string,
  { result: RefreshedSession; expiresAt: number }
>();

function refreshTokenKey(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch (err) {
    logger.error({ error: err }, "supabase_auth_client_init_failed");
    supabase = null;
  }
}

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  supabaseUid: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function readAccessToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === "string") {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }

  const cookie = req.cookies?.[ACCESS_COOKIE];
  if (typeof cookie === "string" && cookie.length > 0) return cookie;

  return undefined;
}

function readRefreshToken(req: Request): string | undefined {
  if (isSessionEndpoint(req) && req.method === "POST") {
    const header = req.headers[REFRESH_HEADER];
    if (typeof header === "string" && header.length > 0) return header.trim();
  }

  const cookie = req.cookies?.[REFRESH_COOKIE];
  if (typeof cookie === "string" && cookie.length > 0) return cookie;

  return undefined;
}

function accessTokenMaxAgeMs(token: string): number {
  try {
    const [, payload] = token.split(".");
    if (!payload) return 55 * 60 * 1000;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8"),
    ) as { exp?: number };
    if (typeof decoded.exp !== "number") return 55 * 60 * 1000;
    return Math.max(
      1_000,
      Math.min(decoded.exp * 1000 - Date.now(), 60 * 60 * 1000),
    );
  } catch {
    return 55 * 60 * 1000;
  }
}

function refreshTokenMaxAgeMs(): number {
  return 30 * 24 * 60 * 60 * 1000;
}

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
}

export function setSessionCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string,
) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...authCookieOptions(),
    maxAge: accessTokenMaxAgeMs(accessToken),
  });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...authCookieOptions(),
      maxAge: refreshTokenMaxAgeMs(),
    });
  }
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, authCookieOptions());
  res.clearCookie(REFRESH_COOKIE, authCookieOptions());
}

function isSessionEndpoint(req: Request): boolean {
  const url = req.originalUrl || req.url || "";
  return url.split("?", 1)[0] === SESSION_PATH;
}

function isPasswordEndpoint(req: Request): boolean {
  const url = req.originalUrl || req.url || "";
  return url.split("?", 1)[0] === PASSWORD_PATH;
}

async function updatePasswordForVerifiedSession(
  req: Request,
  res: Response,
  accessToken: string,
) {
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8 || password.length > 128) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({
      error: "Password must be between 8 and 128 characters.",
    });
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    res.setHeader("Cache-Control", "no-store");
    if (response.ok) return res.status(204).end();

    logger.warn(
      { status: response.status, userId: req.user?.id ?? null },
      "supabase_password_update_rejected",
    );
    if (response.status === 401 || response.status === 403) {
      return res.status(401).json({
        error: "Your secure session has expired. Sign in again.",
      });
    }
    if (response.status === 429) {
      return res.status(429).json({
        error: "Too many password changes. Try again later.",
      });
    }
    return res.status(502).json({
      error: "Unable to change password right now.",
    });
  } catch (error) {
    logger.warn({ error }, "supabase_password_update_failed");
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      error: "Unable to change password right now.",
    });
  }
}

async function verifyAccessToken(token: string): Promise<User | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    return error || !data.user ? null : data.user;
  } catch (error) {
    logger.warn({ error }, "supabase_auth_access_verification_failed");
    return null;
  }
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshedSession | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });
  const session = data.session;
  if (error || !session?.access_token || !session.refresh_token || !data.user) {
    return null;
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    user: data.user,
  };
}

async function refreshAccessTokenSingleFlight(
  refreshToken: string,
): Promise<RefreshedSession | null> {
  const key = refreshTokenKey(refreshToken);
  const now = Date.now();
  const recent = recentRefreshes.get(key);
  if (recent && recent.expiresAt > now) return recent.result;
  if (recent) recentRefreshes.delete(key);

  const existing = refreshFlights.get(key);
  if (existing) return existing;

  const flight = refreshAccessToken(refreshToken)
    .then((result) => {
      if (result) {
        recentRefreshes.set(key, {
          result,
          expiresAt: Date.now() + REFRESH_GRACE_MS,
        });
      }
      return result;
    })
    .finally(() => {
      refreshFlights.delete(key);
    });

  refreshFlights.set(key, flight);
  return flight;
}

export async function supabaseAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (isSessionEndpoint(req) && req.method === "DELETE") {
    clearSessionCookies(res);
    res.setHeader("Cache-Control", "no-store");
    return res.status(204).end();
  }

  if (!supabase) {
    if (process.env.NODE_ENV === "production") {
      logger.error(
        {
          hasSupabaseUrl: Boolean(supabaseUrl),
          hasSupabaseKey: Boolean(supabaseKey),
          path: req.originalUrl || req.url,
        },
        "supabase_auth_unavailable",
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({
        error: "Authentication service unavailable",
        code: "AUTH_UNAVAILABLE",
      });
    }
    return next();
  }

  let token = readAccessToken(req);
  let refreshToken = readRefreshToken(req);
  let authUser = token ? await verifyAccessToken(token) : null;

  if (!authUser && refreshToken) {
    try {
      const refreshed = await refreshAccessTokenSingleFlight(refreshToken);
      if (refreshed) {
        token = refreshed.accessToken;
        refreshToken = refreshed.refreshToken;
        authUser = refreshed.user;
        setSessionCookies(res, refreshed.accessToken, refreshed.refreshToken);
        res.setHeader("x-appforge-session-refreshed", "1");
      }
    } catch (err) {
      // A transient Supabase/network failure must never destroy a still-valid
      // refresh cookie. Leave it intact so the next request can heal the
      // session automatically instead of forcing the customer to sign in.
      logger.warn({ error: err }, "supabase_auth_refresh_failed");
    }
  }

  if (!token || !authUser) {
    if (isSessionEndpoint(req) && req.method === "POST") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(401).json({ error: "Not authenticated" });
    }
    return next();
  }

  try {
    const emailConfirmedAt =
      authUser.email_confirmed_at ?? authUser.confirmed_at ?? null;
    if (!emailConfirmedAt) {
      logger.warn(
        { supabaseUid: authUser.id },
        "supabase_auth_email_confirmation_required",
      );
      clearSessionCookies(res);
      if (isSessionEndpoint(req) && req.method === "POST") {
        res.setHeader("Cache-Control", "no-store");
        return res.status(403).json({
          error: "Email confirmation required",
          code: "EMAIL_CONFIRMATION_REQUIRED",
        });
      }
      return next();
    }

    const supabaseUid = authUser.id;
    const email = (authUser.email ?? "").trim().toLowerCase();
    const name =
      authUser.user_metadata?.["full_name"] ||
      authUser.user_metadata?.["name"] ||
      (email ? email.split("@")[0] : "user");
    const picture = authUser.user_metadata?.["avatar_url"] ?? null;

    const { upsertUserFromAuth, ensureUserCredits } = await import("../db.js");
    const dbUser = await upsertUserFromAuth({
      openId: supabaseUid,
      email,
      name,
      picture,
    });

    if (!dbUser?.id) {
      logger.error({}, "supabase_auth_user_upsert_missing");
      if (isSessionEndpoint(req) && req.method === "POST") {
        return res.status(500).json({ error: "Unable to establish session" });
      }
      return next();
    }

    // Provision the internal AppForge access row as part of authentication,
    // before the client asks for tierStatus. Previously a brand-new user could
    // appear to have zero credits until project creation, which incorrectly
    // surfaced the payment wall even though new users receive free credits.
    await ensureUserCredits(dbUser.id);

    req.user = {
      id: dbUser.id,
      email: email || dbUser.email || "",
      name: dbUser.name ?? name,
      supabaseUid,
    };

    if (isPasswordEndpoint(req) && req.method === "PUT") {
      return updatePasswordForVerifiedSession(req, res, token);
    }

    if (isSessionEndpoint(req) && req.method === "POST") {
      setSessionCookies(res, token, refreshToken);
      res.setHeader("Cache-Control", "no-store");
      return res.status(204).end();
    }
  } catch (err) {
    logger.error({ error: err }, "supabase_auth_verification_failed");
    if (isSessionEndpoint(req) && req.method === "POST") {
      return res.status(401).json({ error: "Not authenticated" });
    }
  }

  next();
}
