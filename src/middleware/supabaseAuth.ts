import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../_core/logger.js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";
const ACCESS_COOKIE = "sb-access-token";
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

export type AuthUser = { id: number; email: string; name: string; supabaseUid: string };

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

function accessTokenMaxAgeMs(token: string): number {
  try {
    const [, payload] = token.split(".");
    if (!payload) return 55 * 60 * 1000;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      exp?: number;
    };
    if (typeof decoded.exp !== "number") return 55 * 60 * 1000;
    return Math.max(
      1_000,
      Math.min(decoded.exp * 1000 - Date.now(), 60 * 60 * 1000),
    );
  } catch {
    return 55 * 60 * 1000;
  }
}

function isSessionEndpoint(req: Request): boolean {
  return req.originalUrl.split("?", 1)[0] === SESSION_PATH;
}

export async function supabaseAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  if (isSessionEndpoint(req) && req.method === "DELETE") {
    res.clearCookie(ACCESS_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(204).end();
  }

  if (!supabase) {
    return next();
  }

  const token = readAccessToken(req);
  if (!token) {
    if (isSessionEndpoint(req) && req.method === "POST") {
      return res.status(401).json({ error: "Not authenticated" });
    }
    return next();
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      if (isSessionEndpoint(req) && req.method === "POST") {
        return res.status(401).json({ error: "Not authenticated" });
      }
      return next();
    }

    const supabaseUid = data.user.id;
    const email = (data.user.email ?? "").trim().toLowerCase();
    const name =
      data.user.user_metadata?.["full_name"] ||
      data.user.user_metadata?.["name"] ||
      (email ? email.split("@")[0] : "user");
    const picture = data.user.user_metadata?.["avatar_url"] ?? null;

    const { upsertUserFromAuth } = await import("../db.js");
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

    req.user = {
      id: dbUser.id,
      email: email || dbUser.email || "",
      name: dbUser.name ?? name,
      supabaseUid,
    };

    if (isSessionEndpoint(req) && req.method === "POST") {
      res.cookie(ACCESS_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: accessTokenMaxAgeMs(token),
      });
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
