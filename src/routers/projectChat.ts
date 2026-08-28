import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { getProjectById, createSeniorDevTask, getProjectFiles } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";
import { ensureUserCredits } from "../db.js";

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

      const [userMsg] = await db
        .insert(schema.projectMessages)
        .values({
          projectId: input.projectId,
          userId: ctx.user.id,
          role: "user",
          content: input.content,
        })
        .returning();

      let seniorDevTaskId: number | null = null;
      if (input.triggerSeniorDev) {
        const credits = await ensureUserCredits(ctx.user.id);
        if (credits.balance < SENIOR_DEV_CREDIT_COST) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Senior Dev requires ${SENIOR_DEV_CREDIT_COST} credits.`,
          });
        }
        const files = await getProjectFiles(input.projectId);
        if (Object.keys(files).length === 0) {
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
            "Senior Dev task created. Open AI Builder or stream the task to apply changes.",
          metadata: { seniorDevTaskId },
        });
      } else {
        await db.insert(schema.projectMessages).values({
          projectId: input.projectId,
          userId: ctx.user.id,
          role: "assistant",
          content:
            "Message saved. Use **Improve with Senior Dev** to apply this request to your project files.",
          metadata: { linkedUserMessageId: userMsg.id },
        });
      }

      return { ok: true, seniorDevTaskId };
    }),
});
