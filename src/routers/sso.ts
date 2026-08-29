import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc.js";
import {
  registerSupabaseSsoProvider,
  supabaseSsoEndpoints,
} from "../services/supabaseSsoAdmin.js";

const appBaseUrl =
  process.env.PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:5173";

export const ssoRouter = router({
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
      const endpoints = supabaseSsoEndpoints();
      return {
        ssoEnabled: org.ssoEnabled,
        ssoProvider: org.ssoProvider,
        ssoProviderId: org.ssoEntityId,
        ssoMetadataUrl: org.ssoMetadataUrl,
        supabaseAcsUrl: endpoints.acsUrl,
        supabaseEntityId: endpoints.entityId,
        appCallbackUrl: `${appBaseUrl.replace(/\/$/, "")}/api/sso/callback`,
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

      const domains = await db.query.organizationDomains.findMany({
        where: eq(schema.organizationDomains.organizationId, input.orgId),
      });
      const verifiedDomains = domains
        .filter((d) => d.verified)
        .map((d) => d.domain);
      if (verifiedDomains.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verify at least one domain before enabling SSO.",
        });
      }

      let providerId = input.entityId ?? null;
      if (input.metadataUrl) {
        try {
          const registered = await registerSupabaseSsoProvider({
            provider: input.provider,
            metadataUrl: input.metadataUrl,
            domains: verifiedDomains,
            clientId: input.clientId,
          });
          providerId = registered.providerId || providerId;
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              err instanceof Error
                ? err.message
                : "Failed to register SSO provider with Supabase",
          });
        }
      }

      await db
        .update(schema.organizations)
        .set({
          ssoEnabled: true,
          ssoProvider: input.provider,
          ssoEntityId: providerId,
          ssoMetadataUrl: input.metadataUrl ?? null,
          ssoClientId: input.clientId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.organizations.id, input.orgId));
      return { ok: true, providerId };
    }),
});
