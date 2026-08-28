import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc.js";

const appBaseUrl =
  process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://appforge.app";

export const ssoRouter = router({
  /** Public SSO discovery for a verified org domain (B2B login page). */
  discover: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const domain = input.email.split("@")[1]?.toLowerCase();
      if (!domain) return { ssoAvailable: false as const };
      const row = await db.query.organizationDomains.findFirst({
        where: eq(schema.organizationDomains.domain, domain),
        with: { organization: true },
      });
      if (!row?.verified || !row.organization?.ssoEnabled) {
        return { ssoAvailable: false as const };
      }
      return {
        ssoAvailable: true as const,
        orgName: row.organization.name,
        provider: row.organization.ssoProvider,
        loginUrl: `/api/sso/login?domain=${encodeURIComponent(domain)}`,
      };
    }),

  getOrgConfig: protectedProcedure
    .input(z.object({ orgId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.organizationId, input.orgId),
          eq(schema.organizationMembers.userId, ctx.user.id),
        ),
      });
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const org = await db.query.organizations.findFirst({
        where: eq(schema.organizations.id, input.orgId),
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });
      return {
        ssoEnabled: org.ssoEnabled,
        ssoProvider: org.ssoProvider,
        ssoEntityId: org.ssoEntityId,
        ssoMetadataUrl: org.ssoMetadataUrl,
        acsUrl: `${appBaseUrl}/api/sso/callback`,
      };
    }),

  configure: protectedProcedure
    .input(
      z.object({
        orgId: z.number().int().positive(),
        provider: z.enum(["saml", "oidc"]),
        entityId: z.string().min(1).max(500).optional(),
        metadataUrl: z.string().url().optional(),
        clientId: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.organizationId, input.orgId),
          eq(schema.organizationMembers.userId, ctx.user.id),
        ),
      });
      if (!membership || membership.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db
        .update(schema.organizations)
        .set({
          ssoEnabled: true,
          ssoProvider: input.provider,
          ssoEntityId: input.entityId ?? null,
          ssoMetadataUrl: input.metadataUrl ?? null,
          ssoClientId: input.clientId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.organizations.id, input.orgId));
      return { ok: true };
    }),
});
