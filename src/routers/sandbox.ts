import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getProjectById } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import {
  ensureSandboxSession,
  execSandboxCommand,
  getSandboxLogs,
  stopSandboxDev,
  getSandboxDevPort,
} from "../services/projectSandbox.js";

export const sandboxRouter = router({
  ensure: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ensureSandboxSession(input.projectId, ctx.user.id);
      return { ok: true };
    }),

  exec: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        command: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const result = await execSandboxCommand(
        input.projectId,
        ctx.user.id,
        input.command,
      );
      return result;
    }),

  logs: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        sinceId: z.number().int().nonnegative().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getSandboxLogs(input.projectId, ctx.user.id, input.sinceId ?? 0);
    }),

  devStatus: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const port = getSandboxDevPort(input.projectId, ctx.user.id);
      return { running: port !== null, port };
    }),

  stopDev: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await stopSandboxDev(input.projectId, ctx.user.id);
      return { ok: true };
    }),
});
