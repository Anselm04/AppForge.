import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { getProjectById, createSeniorDevTask, getProjectFiles } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";
import { ensureUserCredits } from "../db.js";
import { runQuickEdit } from "../services/quickEditAgent.js";
import { resolveProjectStack } from "../lib/projectStack.js";
import { persistChangeContract } from "../services/productionOperationsService.js";

export const projectChatRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.query.projectMessages.findMany({
        where: eq(schema.projectMessages.projectId, input.projectId),
        orderBy: asc(schema.projectMessages.createdAt),
        limit: 200,
      });
    }),

  send: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        content: z.string().min(1).max(8000),
        triggerSeniorDev: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const files = await getProjectFiles(input.projectId);
      const hasBuiltArtifact = Object.keys(files).length > 0;
      let changeContractCreated = false;

      if (hasBuiltArtifact) {
        if (!project.productContract) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "This project has no original ProductContract, so AppForge cannot safely apply a customer change yet.",
          });
        }
        try {
          await persistChangeContract({
            userId: ctx.user.id,
            projectId: input.projectId,
            request: input.content,
            additions: [],
            changes: [input.content],
            removals: [],
          });
          changeContractCreated = true;
        } catch (error) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Unable to create a safe ChangeContract for this update.",
          });
        }
      }

      await db.insert(schema.projectMessages).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        role: "user",
        content: input.content,
        metadata: changeContractCreated
          ? { changeContractCreated: true }
          : undefined,
      });

      let seniorDevTaskId: number | null = null;
      if (input.triggerSeniorDev) {
        const credits = await ensureUserCredits(ctx.user.id);
        const unlimited = !!credits.unlimited || credits.tier === "lifetime";
        if (!unlimited && credits.balance < SENIOR_DEV_CREDIT_COST) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Senior Dev requires ${SENIOR_DEV_CREDIT_COST} credits.`,
          });
        }
        if (!hasBuiltArtifact) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Complete a build before using Senior Dev chat.",
          });
        }
        seniorDevTaskId = await createSeniorDevTask({
          projectId: input.projectId,
          userId: ctx.user.id,
          request: input.content,
          mode: "collaborative",
        });
        await db.insert(schema.projectMessages).values({
          projectId: input.projectId,
          userId: ctx.user.id,
          role: "assistant",
          content:
            "Senior Dev is applying your changes against the original ProductContract with green-preserving validation — watch the stream below.",
          metadata: { seniorDevTaskId, changeContractCreated: true },
        });
      } else if (!hasBuiltArtifact) {
        await db.insert(schema.projectMessages).values({
          projectId: input.projectId,
          userId: ctx.user.id,
          role: "assistant",
          content:
            "Complete a build first — then chat can create a ChangeContract, patch files and refresh preview safely.",
        });
      } else {
        const edit = await runQuickEdit({
          projectId: input.projectId,
          request: input.content,
          techStack: resolveProjectStack(project).techStack,
        });
        await db.insert(schema.projectMessages).values({
          projectId: input.projectId,
          userId: ctx.user.id,
          role: "assistant",
          content: edit.filesChanged.length
            ? `${edit.summary}\n\nUpdated: ${edit.filesChanged.join(", ")}`
            : edit.summary,
          metadata: {
            quickEdit: true,
            changeContractCreated: true,
            filesChanged: edit.filesChanged,
            rolledBack: edit.rolledBack ?? false,
            fixed: edit.fixed ?? false,
            validationPassed: edit.validation?.passed ?? null,
          },
        });
      }

      return { ok: true, seniorDevTaskId, changeContractCreated };
    }),
});
