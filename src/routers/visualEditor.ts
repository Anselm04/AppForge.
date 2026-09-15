import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { getProjectById, getProjectFiles } from "../db.js";
import { applyStaticHtmlVisualEdit } from "../lib/visualHtmlEditor.js";
import { commitValidatedProjectFileEdit } from "../services/projectFileEdits.js";

export const visualEditorRouter = router({
  edit: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        path: z.string().min(1).max(500),
        targetId: z
          .string()
          .min(1)
          .max(120)
          .regex(/^[A-Za-z][A-Za-z0-9_:.-]*$/),
        text: z.string().max(2_000).optional(),
        styles: z
          .object({
            color: z.string().max(120).optional(),
            backgroundColor: z.string().max(120).optional(),
            fontSize: z.string().max(120).optional(),
            fontWeight: z.string().max(120).optional(),
            textAlign: z.string().max(120).optional(),
            padding: z.string().max(120).optional(),
            margin: z.string().max(120).optional(),
            borderRadius: z.string().max(120).optional(),
            width: z.string().max(120).optional(),
            height: z.string().max(120).optional(),
          })
          .strict()
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      if (!/\.html?$/i.test(input.path)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Visual editing currently supports HTML files only",
        });
      }

      try {
        const files = await getProjectFiles(input.projectId);
        const current = files[input.path];
        if (current === undefined) throw new Error("Project file not found");
        const content = applyStaticHtmlVisualEdit(current, {
          targetId: input.targetId,
          text: input.text,
          styles: input.styles,
        });
        return await commitValidatedProjectFileEdit({
          project,
          userId: ctx.user.id,
          path: input.path,
          content,
          label: `Visual edit: #${input.targetId}`,
          requireValid: true,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Visual edit failed";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),
});
