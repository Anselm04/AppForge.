import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

export const ssoHttpRouter = Router();

/** SAML/OIDC login initiation stub — redirects to IdP metadata URL when configured. */
ssoHttpRouter.get("/login", async (req: Request, res: Response) => {
  const domain =
    typeof req.query.domain === "string" ? req.query.domain.toLowerCase() : "";
  if (!domain) {
    res.status(400).json({ error: "domain query param required" });
    return;
  }
  const row = await db.query.organizationDomains.findFirst({
    where: eq(schema.organizationDomains.domain, domain),
    with: { organization: true },
  });
  const org = row?.organization;
  if (!row?.verified || !org?.ssoEnabled || !org.ssoMetadataUrl) {
    res.status(404).type("html").send(`
      <!doctype html><html><body style="font-family:system-ui;padding:2rem">
      <h1>SSO not configured</h1>
      <p>Domain <strong>${domain}</strong> has no verified SSO setup yet.</p>
      <p>Org admins can configure SAML/OIDC under Settings → Organization.</p>
      </body></html>`);
    return;
  }
  res.redirect(org.ssoMetadataUrl);
});

ssoHttpRouter.post("/callback", (_req: Request, res: Response) => {
  res.status(501).json({
    error: "sso_callback_stub",
    message:
      "Wire your IdP ACS URL to this endpoint and map assertions to Supabase SSO.",
  });
});
