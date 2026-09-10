import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { getProjectById } from "../db.js";
import { summarizeIntegrationHealth } from "../integrations/health.js";
import {
  capturePostHogEvent,
  runMakeWorkflow,
  sendBubblaVSupportMessage,
  sendDatadogLog,
} from "../integrations/runtime.js";
import { sendProjectToMarketing } from "../services/marketingBridge.js";
import { logger } from "../_core/logger.js";

const automationPayloadSchema = z
  .record(z.unknown())
  .refine((payload) => JSON.stringify(payload).length <= 50_000, {
    message: "Automation payload is too large",
  });

async function observeEcosystemAction(input: {
  event: string;
  userId: number;
  properties?: Record<string, unknown>;
}) {
  await Promise.allSettled([
    capturePostHogEvent({
      event: input.event,
      distinctId: String(input.userId),
      properties: input.properties,
    }),
    sendDatadogLog({
      message: input.event,
      attributes: {
        userId: input.userId,
        ...(input.properties ?? {}),
      },
    }),
  ]);
}

export const ecosystemRouter = router({
  integrations: protectedProcedure.query(async () =>
    summarizeIntegrationHealth(),
  ),

  runAutomation: protectedProcedure
    .input(
      z.object({
        event: z.string().trim().min(1).max(64),
        payload: automationPayloadSchema.default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await runMakeWorkflow({
          event: input.event,
          payload: input.payload,
          actor: { id: ctx.user.id, email: ctx.user.email },
        });

        await observeEcosystemAction({
          event: "appforge_make_workflow_completed",
          userId: ctx.user.id,
          properties: { workflowEvent: input.event },
        });

        return {
          success: true as const,
          status: result.status,
          result: result.data,
        };
      } catch (error) {
        logger.error(
          { error, userId: ctx.user.id, event: input.event },
          "make_workflow_failed",
        );
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Automation service unavailable",
        });
      }
    }),

  supportMessage: protectedProcedure
    .input(
      z.object({
        message: z.string().trim().min(1).max(4_000),
        context: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await sendBubblaVSupportMessage({
          message: input.message,
          actor: {
            id: ctx.user.id,
            email: ctx.user.email,
            name: ctx.user.name,
          },
          context: input.context,
        });

        await observeEcosystemAction({
          event: "appforge_support_message_sent",
          userId: ctx.user.id,
        });

        return {
          success: true as const,
          status: result.status,
          result: result.data,
        };
      } catch (error) {
        logger.error(
          { error, userId: ctx.user.id },
          "bubblav_support_message_failed",
        );
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Support service unavailable",
        });
      }
    }),

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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
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
          productName:
            project.title?.trim() || `AppForge Project ${project.id}`,
          description:
            project.description?.trim() || "AppForge-generated product",
          techStack: project.techStack?.trim() || "unknown",
          ...(input.productUrl ? { productUrl: input.productUrl } : {}),
          mode: input.mode,
        });

        logger.info(
          { projectId: project.id, userId: ctx.user.id, mode: input.mode },
          "project_sent_to_marketing",
        );
        await observeEcosystemAction({
          event: "appforge_project_sent_to_marketing",
          userId: ctx.user.id,
          properties: { projectId: project.id, mode: input.mode },
        });
        return { success: true as const, result };
      } catch (error) {
        logger.error(
          {
            error,
            projectId: project.id,
            userId: ctx.user.id,
            mode: input.mode,
          },
          "marketing_bridge_failed",
        );
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : 0;
        if (statusCode === 409) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Create or sign in to the matching TrillionAI Marketing account first",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Marketing service unavailable",
        });
      }
    }),
});
