import { Router, Request, Response } from "express";

export const authSessionRouter = Router();

const ACCESS_COOKIE = "sb-access-token";

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function accessTokenMaxAgeMs(token: string): number {
  try {
    const [, payload] = token.split(".");
    if (!payload) return 55 * 60 * 1000;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8"),
    ) as {
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

authSessionRouter.post("/session", (req: Request, res: Response) => {
  const user = req.user;
  const token = bearerToken(req);
  if (!user || !token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.cookie(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: accessTokenMaxAgeMs(token),
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true });
});

authSessionRouter.delete("/session", (_req: Request, res: Response) => {
  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true });
});
