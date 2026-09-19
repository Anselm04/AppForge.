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
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string,
) {
  const opts = authCookieOptions();
  const accessMaxAge = accessTokenMaxAgeMs(accessToken);
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...opts,
    maxAge: accessMaxAge,
  });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...opts,
      maxAge: refreshTokenMaxAgeMs(),
    });
  }
  logger.info(
    {
      accessCookie: ACCESS_COOKIE,
      hasRefresh: Boolean(refreshToken),
      sameSite: opts.sameSite,
      secure: opts.secure,
      path: opts.path,
      accessMaxAgeMs: accessMaxAge,
    },
    "supabase_auth_session_cookies_set",
  );
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, authCookieOptions());
  res.clearCookie(REFRESH_COOKIE, authCookieOptions());
}

function isSessionEndpoint(req: Request): boolean {
  const raw = (req.originalUrl || req.url || "").split("?", 1)[0];
  return (
    raw === SESSION_PATH ||
    raw === "/auth/session" ||
    raw.endsWith("/auth/session")
  );
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

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  user: User;
} | null> {
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
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed.accessToken;
        refreshToken = refreshed.refreshToken;
        authUser = refreshed.user;
        setSessionCookies(res, refreshed.accessToken, refreshed.refreshToken);
        res.setHeader("x-appforge-session-refreshed", "1");
      } else {
        clearSessionCookies(res);
      }
    } catch (err) {
      logger.warn({ error: err }, "supabase_auth_refresh_failed");
      clearSessionCookies(res);
    }
  }

  if (!token || !authUser) {
    if (isSessionEndpoint(req) && req.method === "POST") {
      logger.warn(
        {
          hasAccessToken: Boolean(token),
          hasRefreshToken: Boolean(refreshToken),
          hasAuthHeader: Boolean(req.headers.authorization),
        },
        "supabase_auth_session_rejected",
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(401).json({
        error: "Not authenticated",
        code: "AUTH_REQUIRED",
      });
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

    const { ensureUserCredits } = await import("../db.js");
    const { upsertUserFromAuth } = await import("../db/upsertUserFromAuth.js");
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

    await ensureUserCredits(dbUser.id);

    req.user = {
      id: dbUser.id,
      email: email || dbUser.email || "",
      name: dbUser.name ?? name,
      supabaseUid,
    };

    if (isSessionEndpoint(req) && req.method === "POST") {
      setSessionCookies(res, token, refreshToken);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        ok: true,
        userId: dbUser.id,
        supabaseUid,
      });
    }
  } catch (err) {
    logger.error({ error: err }, "supabase_auth_verification_failed");
    if (isSessionEndpoint(req) && req.method === "POST") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(500).json({
        error: "Unable to establish session",
        code: "SESSION_UPSERT_FAILED",
      });
    }
  }

  next();
}
