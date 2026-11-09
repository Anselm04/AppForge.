import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { db, getProjectById } from "../db.js";
import {
  aftercareGuidance,
  compareDeploymentChoices,
  summariseOngoingCosts,
  type CustomerServiceCost,
} from "../lib/aftercarePlanning.js";

type ServiceRow = {
  service_key: string;
  provider: string;
  monthly_usd_cents: number | null;
  variable_cost: boolean;
  billed_to: "customer" | "trillionai";
  notes: string;
  accepted: boolean;
  accepted_at: Date | null;
};

async function ownedProject(userId: number, projectId: number) {
  const project = await getProjectById(projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  if (project.userId !== userId)
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  return project;
}

async function serviceRows(userId: number, projectId: number) {
  const result = await db.execute<ServiceRow>(sql`
    SELECT service_key, provider, monthly_usd_cents, variable_cost,
      billed_to, notes, accepted, accepted_at
    FROM customer_aftercare_services
    WHERE user_id = ${userId} AND project_id = ${projectId}
    ORDER BY service_key
  `);
  return Array.isArray(result) ? result : [];
}

export const aftercareRouter = router({
  overview: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId);
      const stored = await serviceRows(ctx.user.id, input.projectId);
      const costs: CustomerServiceCost[] = stored.map((row) => ({
        service: row.service_key,
        provider: row.provider,
        monthlyUsdCents: row.monthly_usd_cents,
        variable: row.variable_cost,
        billedTo: row.billed_to,
        notes: row.notes,
      }));
      return {
        project: {
          id: project.id,
          title: project.title,
          techStack: project.techStack,
          status: project.status,
        },
        options: compareDeploymentChoices(project.techStack),
        services: stored,
        total: summariseOngoingCosts(costs),
        note: "Figures are recorded estimates, not verified live provider invoices.",
      };
    }),

  saveService: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      serviceKey: z.string().trim().min(2).max(90).regex(/^[A-Za-z0-9 _.-]+$/),
      provider: z.string().trim().min(2).max(120),
      monthlyUsdCents: z.number().int().min(0).max(10_000_000).nullable(),
      variableCost: z.boolean(),
      billedTo: z.enum(["customer", "trillionai"]),
      notes: z.string().trim().max(500).default(""),
      accepted: z.literal(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await ownedProject(ctx.user.id, input.projectId);
      if (input.billedTo === "trillionai")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "AppForge-managed provider billing needs a separate verified agreement.",
        });
      await db.execute(sql`
        INSERT INTO customer_aftercare_services
          (user_id, project_id, service_key, provider,
           monthly_usd_cents, variable_cost, billed_to,
           notes, accepted, accepted_at)
        VALUES (
          ${ctx.user.id}, ${input.projectId}, ${input.serviceKey},
          ${input.provider}, ${input.monthlyUsdCents}, ${input.variableCost},
          ${input.billedTo}, ${input.notes}, TRUE, NOW()
        )
        ON CONFLICT (user_id, project_id, service_key) DO UPDATE SET
          provider = EXCLUDED.provider,
          monthly_usd_cents = EXCLUDED.monthly_usd_cents,
          variable_cost = EXCLUDED.variable_cost,
          billed_to = EXCLUDED.billed_to,
          notes = EXCLUDED.notes,
          accepted = TRUE,
          accepted_at = NOW(),
          updated_at = NOW()
      `);
      return { saved: true as const };
    }),

  ask: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      question: z.string().trim().min(3).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId);
      const stored = await serviceRows(ctx.user.id, input.projectId);
      const costs: CustomerServiceCost[] = stored.map((row) => ({
        service: row.service_key,
        provider: row.provider,
        monthlyUsdCents: row.monthly_usd_cents,
        variable: row.variable_cost,
        billedTo: row.billed_to,
        notes: row.notes,
      }));
      return {
        answer: aftercareGuidance(input.question, {
          name: project.title || `Project #${project.id}`,
          stack: project.techStack,
          status: project.status,
          costs,
        }),
        isAutomatedGuidance: true as const,
        note: "Project-specific help, not a live provider diagnosis. No paid AI call was made.",
      };
    }),
});
