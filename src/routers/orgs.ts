import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { promises as dns } from "dns";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { protectedProcedure, router } from "../_core/trpc.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ORGANIZATION_DOMAIN_PATTERN =
  /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function normalizeOrganizationSlug(name: string, requested?: string): string {
  const slug = slugify(requested?.trim() || name);
  if (slug.length < 2 || !ORGANIZATION_SLUG_PATTERN.test(slug)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Organization name must produce a URL-safe slug with at least two letters or numbers.",
    });
  }
  return slug;
}

export function normalizeOrganizationDomain(input: string): string {
  const domain = input.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  if (!ORGANIZATION_DOMAIN_PATTERN.test(domain)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Enter a valid organization domain such as example.com.",
    });
  }
  return domain;
}

export const orgsRouter = router({
  myOrgs: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await db.query.organizationMembers.findMany({
      where: eq(schema.organizationMembers.userId, ctx.user.id),
      with: { organization: true },
    });
    return memberships.map((m) => ({
      role: m.role,
      org: m.organization,
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(120),
        slug: z.string().trim().min(2).max(48).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = normalizeOrganizationSlug(input.name, input.slug);
      const existing = await db.query.organizations.findFirst({
        where: eq(schema.organizations.slug, slug),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Organization slug already taken.",
        });
      }
      const [org] = await db
        .insert(schema.organizations)
        .values({
          name: input.name,
          slug,
          ownerUserId: ctx.user.id,
        })
        .returning();
      await db.insert(schema.organizationMembers).values({
        organizationId: org.id,
        userId: ctx.user.id,
        role: "owner",
      });
      return org;
    }),

  invite: protectedProcedure
    .input(
      z.object({
        orgId: z.number().int().positive(),
        email: z.string().email(),
        role: z.enum(["admin", "member"]).default("member"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.organizationId, input.orgId),
          eq(schema.organizationMembers.userId, ctx.user.id),
        ),
      });
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, input.email.toLowerCase()),
      });
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must sign up before joining an org.",
        });
      }
      const existing = await db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.organizationId, input.orgId),
          eq(schema.organizationMembers.userId, user.id),
        ),
      });
      if (!existing) {
        await db.insert(schema.organizationMembers).values({
          organizationId: input.orgId,
          userId: user.id,
          role: input.role,
        });
      }
      return { ok: true, userId: user.id };
    }),

  setDomain: protectedProcedure
    .input(
      z.object({
        orgId: z.number().int().positive(),
        domain: z.string().trim().min(3).max(255),
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
      const domain = normalizeOrganizationDomain(input.domain);
      await db
        .insert(schema.organizationDomains)
        .values({
          organizationId: input.orgId,
          domain,
          verified: false,
        })
        .onConflictDoNothing();
      return {
        ok: true,
        domain,
        verificationHint: `TXT appforge-verify=${input.orgId}`,
      };
    }),

  verifyDomain: protectedProcedure
    .input(
      z.object({
        orgId: z.number().int().positive(),
        domain: z.string().trim().min(3).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.organizationId, input.orgId),
          eq(schema.organizationMembers.userId, ctx.user.id),
        ),
      });
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const domain = normalizeOrganizationDomain(input.domain);
      const row = await db.query.organizationDomains.findFirst({
        where: and(
          eq(schema.organizationDomains.organizationId, input.orgId),
          eq(schema.organizationDomains.domain, domain),
        ),
      });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Domain not registered",
        });
      }

      const expected = `appforge-verify=${input.orgId}`;
      let verified =
        process.env.NODE_ENV !== "production" &&
        process.env.SSO_AUTO_VERIFY === "true";
      if (!verified) {
        try {
          const records = await dns.resolveTxt(domain);
          verified = records.some((chunks) => chunks.join("").trim() === expected);
        } catch {
          verified = false;
        }
      }

      if (!verified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Add DNS TXT record: ${expected}`,
        });
      }

      await db
        .update(schema.organizationDomains)
        .set({ verified: true })
        .where(eq(schema.organizationDomains.id, row.id));
      return { ok: true, domain, verified: true };
    }),
});
