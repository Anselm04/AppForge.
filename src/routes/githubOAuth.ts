import { Router, Request, Response } from "express";
import { upsertGithubConnection } from "../db.js";
import { logger } from "../_core/logger.js";

const router = Router();

function appBaseUrl(req: Request): string {
  const fromEnv = (process.env.APP_URL || process.env.CORS_ORIGIN || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers.host || "localhost";
  return `${proto}://${host}`;
}

/**
 * GET /callback — exchange GitHub OAuth code for an access token,
 * store the connection, and redirect to the dashboard.
 */
router.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const stateRaw = typeof req.query.state === "string" ? req.query.state : null;
  const base = appBaseUrl(req);

  if (!code || !stateRaw) {
    res.redirect(`${base}/dashboard?github=missing_params`);
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    logger.error("GitHub OAuth callback: GITHUB_CLIENT_ID/SECRET not configured");
    res.redirect(`${base}/dashboard?github=not_configured`);
    return;
  }

  let userId: number;
  try {
    const state = JSON.parse(Buffer.from(stateRaw, "base64").toString("utf8")) as {
      userId?: number;
    };
    if (!state.userId || !Number.isFinite(state.userId)) {
      throw new Error("invalid state userId");
    }
    userId = state.userId;
  } catch {
    res.redirect(`${base}/dashboard?github=invalid_state`);
    return;
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!tokenRes.ok) {
      throw new Error(`token exchange failed: ${tokenRes.status}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "no access_token");
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "AppForge",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!userRes.ok) {
      throw new Error(`GitHub user fetch failed: ${userRes.status}`);
    }

    const ghUser = (await userRes.json()) as { login?: string };
    const githubUsername = ghUser.login || `user-${userId}`;

    await upsertGithubConnection({
      userId,
      githubUsername,
      accessToken: tokenData.access_token,
    });

    res.redirect(`${base}/dashboard?github=connected`);
  } catch (err: unknown) {
    logger.error(
      { err: err instanceof Error ? err.message : err, userId },
      "github_oauth_callback_failed",
    );
    res.redirect(`${base}/dashboard?github=error`);
  }
});

export default router;
export const githubOAuthRouter = router;
