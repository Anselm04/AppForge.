import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  accountDeletionProcedure,
  protectedProcedure,
  router,
} from "../_core/trpc.js";
import { getUserById } from "../db.js";
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
import { verifySupabaseAuthUser } from "../services/supabaseAccountAdmin.js";

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

  deleteAccount: accountDeletionProcedure
    .input(
      z.object({
        confirmation: z.literal("DELETE MY APPFORGE ACCOUNT"),
        accessToken: z.string().min(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new Error("Account identity is unavailable");

        if (ctx.accountDeletionState === "active") {
          if (!user.openId) throw new Error("Account identity is unavailable");

          // A client-supplied JWT timestamp is not sufficient reauthentication
          // evidence. Supabase must cryptographically validate the token and
          // bind it to this same AppForge identity before its issue time can be
          // accepted as recent-session proof for irreversible deletion.
          await verifySupabaseAuthUser(input.accessToken, user.openId);
        }

        // Pending deletion is a retry of an already-authorized destructive
        // workflow. The provider identity may already be gone, but the caller
        // must still hold an authenticated, recently-issued session.
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
