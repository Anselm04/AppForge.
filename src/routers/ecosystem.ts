import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { getProjectById } from "../db.js";
import { summarizeIntegrationHealth } from "../integrations/health.js";
import { sendProjectToMarketing } from "../services/marketingBridge.js";
import { logger } from "../_core/logger.js";

export const ecosystemRouter = router({
  integrations: protectedProcedure.query(async () => summarizeIntegrationHealth()),

  sendToMarketing: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        productUrl: z.string().url().optional(),
        mode: z.enum(["draft", "generate"]).default("draft"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      if (project.status !== "completed") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only completed AppForge projects can be sent to marketing",
        });
      }

      if (input.productUrl && process.env.NODE_ENV === "production") {
        const parsed = new URL(input.productUrl);
        if (parsed.protocol !== "https:") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Production product URLs must use HTTPS",
          });
        }
      }

      try {
        const result = await sendProjectToMarketing({
          source: "appforge",
          sourceProjectId: project.id,
          sourceProjectCreatedAt: project.createdAt
            ? new Date(project.createdAt).toISOString()
            : null,
          sourceUserEmail: ctx.user.email,
          sourceUserName: ctx.user.name ?? ctx.user.email,
          productName: project.title?.trim() || `AppForge Project ${project.id}`,
          description: project.description?.trim() || "AppForge-generated product",
          techStack: project.techStack?.trim() || "unknown",
          ...(input.productUrl ? { productUrl: input.productUrl } : {}),
          mode: input.mode,
        });

        logger.info(
          { projectId: project.id, userId: ctx.user.id, mode: input.mode },
          "project_sent_to_marketing",
        );
        return { success: true as const, result };
      } catch (error) {
        logger.error(
          { error, projectId: project.id, userId: ctx.user.id, mode: input.mode },
          "marketing_bridge_failed",
        );
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : 0;
        if (statusCode === 409) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Create or sign in to the matching TrillionAI Marketing account first",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Marketing service unavailable",
        });
      }
    }),
});
