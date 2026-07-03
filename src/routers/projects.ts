import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  countBuildsThisMonth,
  createProject,
  getAgentLogsByProject,
  getProjectById,
  getProjectsByUserId,
  isUserPro,
  updateProjectStatus,
} from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";

const FREE_TIER_LIMIT = 3;

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getProjectsByUserId(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      return project;
    }),

  getLogs: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      return getAgentLogsByProject(input.projectId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        description: z.string().min(10).max(2000),
        techStack: z.string().default("react-node"),
        title: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Backend tier enforcement
      const pro = await isUserPro(ctx.user.id);
      if (!pro) {
        const buildsThisMonth = await countBuildsThisMonth(ctx.user.id);
        if (buildsThisMonth >= FREE_TIER_LIMIT) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Free tier limit reached (${FREE_TIER_LIMIT} builds/month). Upgrade to Pro for unlimited builds.`,
          });
        }
      }

      const id = await createProject({
        userId: ctx.user.id,
        title: input.title,
        description: input.description,
        techStack: input.techStack,
        status: "pending",
      });

      return { id };
    }),

  tierStatus: protectedProcedure.query(async ({ ctx }) => {
    const pro = await isUserPro(ctx.user.id);
    const buildsThisMonth = await countBuildsThisMonth(ctx.user.id);
    return {
      isPro: pro,
      buildsThisMonth,
      limit: pro ? null : FREE_TIER_LIMIT,
      remaining: pro ? null : Math.max(0, FREE_TIER_LIMIT - buildsThisMonth),
    };
  }),
});
