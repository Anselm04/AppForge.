import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { getProjectById } from "../db.js";
import { commitValidatedProjectFileEdit } from "../services/projectFileEdits.js";

export const versionedWritesRouter = router({
  updateFile: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        path: z.string().min(1).max(500),
        content: z.string().max(500_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      try {
        return await commitValidatedProjectFileEdit({
          project,
          userId: ctx.user.id,
          path: input.path,
          content: input.content,
          label: `Manual edit: ${input.path}`,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "File update failed";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),
});
