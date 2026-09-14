import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { getProjectById, getProjectFiles, updateProjectFiles } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";

const SAFE_ASSET_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const ACTIVE_SVG_CONTENT =
  /<\s*(?:script|foreignObject|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:/i;

export function validateAssetAttachment(input: {
  filename: string;
  mimeType?: string;
  content: string;
}): void {
  const filename = input.filename.trim();
  if (
    !SAFE_ASSET_FILENAME.test(filename) ||
    filename === "." ||
    filename === ".." ||
    filename.includes("..")
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Asset filename must be a safe file name without path traversal.",
    });
  }

  const mimeType = (input.mimeType ?? "image/svg+xml").toLowerCase();
  if (mimeType === "image/svg+xml") {
    const trimmed = input.content.trimStart();
    if (!trimmed.startsWith("<svg") && !trimmed.startsWith("<?xml")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "SVG assets must contain SVG markup.",
      });
    }
    if (ACTIVE_SVG_CONTENT.test(input.content)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "SVG assets may not contain scripts, embedded documents, or event handlers.",
      });
    }
  }
}

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
        filename: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().max(120).optional(),
        content: z.string().min(1).max(500_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      validateAssetAttachment(input);
      const filename = input.filename.trim();
      const mimeType = input.mimeType?.trim() || "image/svg+xml";

      const [asset] = await db
        .insert(schema.projectAssets)
        .values({
          projectId: input.projectId,
          userId: ctx.user.id,
          filename,
          mimeType,
          content: input.content,
        })
        .returning();

      const dest = `public/assets/${filename}`;
      const files = await getProjectFiles(input.projectId);
      await updateProjectFiles(input.projectId, {
        ...files,
        [dest]: input.content,
      });

      return { assetId: asset.id, path: dest };
    }),
});
