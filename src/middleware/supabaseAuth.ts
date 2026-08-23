import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export type AuthUser = { id: number; email: string; name: string; supabaseUid: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function supabaseAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!supabase) {
    return next();
  }

  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    req.cookies?.["sb-access-token"] ||
    (req.query?.token as string | undefined);
  if (!token) {
    return next();
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return next();
    }

    const supabaseUid = data.user.id;
    const email = data.user.email ?? "";

    // Look up our local user record by open_id (Supabase UID) or create on first visit
    const { getUserByOpenId, createUser } = await import("../db.js");
    let dbUser = await getUserByOpenId(supabaseUid);

    if (!dbUser) {
      dbUser = await createUser({
        openId: supabaseUid,
        email,
        name: data.user.user_metadata?.["full_name"] || data.user.user_metadata?.["name"] || email.split("@")[0],
        picture: data.user.user_metadata?.["avatar_url"] ?? null,
      });
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email ?? email,
      name: dbUser.name ?? email.split("@")[0],
      supabaseUid,
    };
  } catch (err) {
    console.error("Supabase auth verification error:", err);
  }

  next();
}