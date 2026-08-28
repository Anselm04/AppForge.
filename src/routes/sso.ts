import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import {
  exchangeSupabaseSsoCode,
  initiateSupabaseSso,
} from "../services/supabaseSso.js";

export const ssoHttpRouter = Router();

const appBaseUrl =
  process.env.PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:5173";

const SSO_VERIFIER_COOKIE = "appforge_sso_verifier";
const SSO_NEXT_COOKIE = "appforge_sso_next";

function safeNext(value: unknown): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }
  return "/dashboard";
}

/** SP-initiated enterprise login — redirects through Supabase SSO to the org IdP. */
ssoHttpRouter.get("/login", async (req: Request, res: Response) => {
  try {
    const domain =
      typeof req.query.domain === "string"
        ? req.query.domain.toLowerCase()
        : "";
    const next = safeNext(req.query.next);
    if (!domain) {
      res.status(400).json({ error: "domain query param required" });
      return;
    }

    const row = await db.query.organizationDomains.findFirst({
      where: eq(schema.organizationDomains.domain, domain),
      with: { organization: true },
    });
    const org = row?.organization;
    if (!row?.verified || !org?.ssoEnabled) {
      res.status(404).type("html").send(`
        <!doctype html><html><body style="font-family:system-ui;padding:2rem">
        <h1>SSO not configured</h1>
        <p>Domain <strong>${domain}</strong> is not verified or SSO is disabled.</p>
        </body></html>`);
      return;
    }

    const callbackUrl = `${appBaseUrl.replace(/\/$/, "")}/api/sso/callback`;
    const init = await initiateSupabaseSso({
      domain,
      providerId: org.ssoEntityId || undefined,
      redirectTo: callbackUrl,
    });

    res.cookie(SSO_VERIFIER_COOKIE, init.codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });
    res.cookie(SSO_NEXT_COOKIE, next, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });
    res.redirect(init.url);
  } catch (err) {
    console.error("SSO login failed:", err);
    res.status(500).type("html").send(`
      <!doctype html><html><body style="font-family:system-ui;padding:2rem">
      <h1>SSO login failed</h1>
      <p>${err instanceof Error ? err.message : "Unknown error"}</p>
      <p><a href="/login">Back to sign in</a></p>
      </body></html>`);
  }
});

/** Supabase SSO callback — exchange auth code for session and hand off to SPA. */
ssoHttpRouter.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const verifier = req.cookies?.[SSO_VERIFIER_COOKIE] as string | undefined;
  const next = safeNext(req.cookies?.[SSO_NEXT_COOKIE]);
  res.clearCookie(SSO_VERIFIER_COOKIE, { path: "/" });
  res.clearCookie(SSO_NEXT_COOKIE, { path: "/" });

  if (!code || !verifier) {
    res.redirect(
      `/login?error=sso_missing_code&next=${encodeURIComponent(next)}`,
    );
    return;
  }

  try {
    const tokens = await exchangeSupabaseSsoCode(code, verifier);
    const sessionPayload = encodeURIComponent(
      JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        user: tokens.user,
      }),
    );
    res.redirect(
      `/auth/sso/callback?session=${sessionPayload}&next=${encodeURIComponent(next)}`,
    );
  } catch (err) {
    console.error("SSO callback exchange failed:", err);
    res.redirect(
      `/login?error=sso_exchange_failed&next=${encodeURIComponent(next)}`,
    );
  }
});
