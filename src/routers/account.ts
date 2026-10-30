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
import {
  requestAccountReauthentication,
  updateAccountCredentials,
} from "../services/accountCredentials.js";
import { MIN_PASSWORD_LENGTH } from "../lib/passwordStrength.js";

function requireProviderToken(token: string | undefined): string {
  if (!token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in again before changing account credentials.",
    });
  }
  return token;
}

function asBadRequest(error: unknown): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: error instanceof Error ? error.message : "Account request failed",
  });
}

export const accountRouter = router({
  requestPasswordVerification: protectedProcedure.mutation(async ({ ctx }) => {
    const token = requireProviderToken(ctx.req.authAccessToken);
    try {
      await requestAccountReauthentication(token);
      return { sent: true } as const;
    } catch (error) {
      asBadRequest(error);
    }
  }),

  changePassword: protectedProcedure
    .input(
      z.object({
        password: z.string().min(MIN_PASSWORD_LENGTH).max(1024),
        nonce: z.string().trim().min(1).max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const token = requireProviderToken(ctx.req.authAccessToken);
      try {
        await updateAccountCredentials(token, {
          password: input.password,
          ...(input.nonce ? { nonce: input.nonce } : {}),
        });
        return { updated: true } as const;
      } catch (error) {
        asBadRequest(error);
      }
    }),

  changeEmail: protectedProcedure
    .input(
      z.object({ email: z.string().trim().toLowerCase().email().max(254) }),
    )
    .mutation(async ({ ctx, input }) => {
      const token = requireProviderToken(ctx.req.authAccessToken);
      try {
        await updateAccountCredentials(token, { email: input.email });
        return { confirmationRequired: true } as const;
      } catch (error) {
        asBadRequest(error);
      }
    }),

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
        accessToken: z.string().min(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new Error("Account identity is unavailable");
        const accessToken = requireProviderToken(
          ctx.req.authAccessToken ?? input.accessToken,
        );

        if (ctx.accountDeletionState === "active") {
          if (!user.openId) throw new Error("Account identity is unavailable");

          // A client-supplied JWT timestamp is not sufficient reauthentication
          // evidence. Supabase must cryptographically validate the token and
          // bind it to this same AppForge identity before its AMR claim can be
          // accepted as recent-session proof for irreversible deletion.
          await verifySupabaseAuthUser(accessToken, user.openId);
        }

        // Pending deletion is a retry of an already-authorized destructive
        // workflow. The provider identity may already be gone, but the caller
        // must still hold an authenticated session with recent sign-in proof.
        assertRecentSession(accessToken);

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
