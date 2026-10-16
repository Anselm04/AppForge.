import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import {
  listMySupportCases,
  listProjectChangeContracts,
  persistChangeContract,
  persistSupportCase,
} from "../services/productionOperationsService.js";

function fail(error: unknown): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: error instanceof Error ? error.message : "Operation failed",
  });
}

export const operationsRouter = router({
  proposeChange: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        request: z.string().min(3).max(8000),
        additions: z.array(z.string().min(1).max(1000)).max(100).default([]),
        changes: z.array(z.string().min(1).max(1000)).max(100).default([]),
        removals: z.array(z.string().min(1).max(1000)).max(100).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await persistChangeContract({ userId: ctx.user.id, ...input });
      } catch (error) {
        fail(error);
      }
    }),

  changeHistory: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        return await listProjectChangeContracts(ctx.user.id, input.projectId);
      } catch (error) {
        fail(error);
      }
    }),

  createSupportCase: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive().nullable().optional(),
        buildRef: z.string().max(128).nullable().optional(),
        severity: z.enum(["SEV-1", "SEV-2", "SEV-3", "SEV-4"]).default("SEV-3"),
        category: z.string().min(2).max(80),
        customerSummary: z.string().min(3).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await persistSupportCase({ userId: ctx.user.id, ...input });
      } catch (error) {
        fail(error);
      }
    }),

  mySupportCases: protectedProcedure.query(({ ctx }) => {
    return listMySupportCases(ctx.user.id);
  }),
});
