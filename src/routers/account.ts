import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import {
  assertRecentSession,
  completeAccountDeletion,
} from "../lib/accountLifecycle.js";
import { buildCustomerDataExport } from "../lib/customerDataExport.js";
import {
  getAccountLifecycleProfile,
  productionAccountDeletionDependencies,
  updateAccountLifecycleProfile,
} from "../services/accountLifecycleService.js";

function asBadRequest(error: unknown): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: error instanceof Error ? error.message : "Account request failed",
  });
}

export const accountRouter = router({
  profile: protectedProcedure.query(({ ctx }) => {
    return getAccountLifecycleProfile(ctx.user.id);
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().max(255).nullable().optional(),
        preferences: z
          .object({
            language: z.string().min(2).max(32).optional(),
            communications: z
              .object({
                product: z.boolean().optional(),
                billing: z.boolean().optional(),
                marketing: z.boolean().optional(),
              })
              .optional(),
            accessibility: z
              .object({
                reducedMotion: z.boolean().optional(),
                highContrast: z.boolean().optional(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return updateAccountLifecycleProfile(ctx.user.id, input);
    }),

  exportData: protectedProcedure.query(({ ctx }) => {
    return buildCustomerDataExport(ctx.user.id);
  }),

  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmation: z.literal("DELETE MY APPFORGE ACCOUNT"),
        accessToken: z.string().min(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        assertRecentSession(input.accessToken);
        await completeAccountDeletion(
          ctx.user.id,
          productionAccountDeletionDependencies(),
        );
        return { deleted: true } as const;
      } catch (error) {
        asBadRequest(error);
      }
    }),
});
