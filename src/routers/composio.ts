import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import {
  createComposioSession,
  isComposioConfigured,
  searchComposioTools,
} from "../services/composio.js";

export const composioRouter = router({
  status: protectedProcedure.query(() => ({
    configured: isComposioConfigured(),
  })),

  searchTools: protectedProcedure
    .input(
      z.object({
        useCase: z.string().trim().min(3).max(300),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isComposioConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Composio is not configured for AppForge",
        });
      }

      try {
        const session = await createComposioSession(String(ctx.user.id));
        return await searchComposioTools(session, input.useCase);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Composio request failed";
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message,
          cause: error,
        });
      }
    }),
});
