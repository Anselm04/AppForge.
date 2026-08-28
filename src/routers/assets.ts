import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { getProjectById, getProjectFiles, updateProjectFiles } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";

export const assetsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.query.projectAssets.findMany({
        where: eq(schema.projectAssets.projectId, input.projectId),
      });
    }),

  attach: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        filename: z.string().min(1).max(255),
        mimeType: z.string().optional(),
        content: z.string().min(1).max(500_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [asset] = await db
        .insert(schema.projectAssets)
        .values({
          projectId: input.projectId,
          userId: ctx.user.id,
          filename: input.filename,
          mimeType: input.mimeType ?? "image/svg+xml",
          content: input.content,
        })
        .returning();

      const dest = `public/assets/${input.filename}`;
      const files = await getProjectFiles(input.projectId);
      await updateProjectFiles(input.projectId, {
        ...files,
        [dest]: input.content,
      });

      return { assetId: asset.id, path: dest };
    }),
});
