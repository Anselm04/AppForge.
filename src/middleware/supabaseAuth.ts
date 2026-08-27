import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  } catch (err) {
    console.error("Failed to initialize Supabase auth client:", err);
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
  const cookie = req.cookies?.["sb-access-token"];
  if (typeof cookie === "string" && cookie.length > 0) return cookie;
  const queryToken = req.query?.token;
  if (typeof queryToken === "string" && queryToken.length > 0) return queryToken;
  return undefined;
}

export async function supabaseAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!supabase) {
    return next();
  }

  const token = readAccessToken(req);
  if (!token) {
    return next();
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
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
      console.error("Supabase auth: user upsert returned no row");
      return next();
    }

    req.user = {
      id: dbUser.id,
      // Prefer the verified JWT email so isOwner matches the signed-in Gmail
      // even if the users row still has a stale or empty address.
      email: email || dbUser.email || "",
      name: dbUser.name ?? name,
      supabaseUid,
    };
  } catch (err) {
    console.error("Supabase auth verification error:", err);
  }

  next();
}
