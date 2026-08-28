import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getGithubConnection, getProjectById, getProjectFiles } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { pushFilesToGitHubRepo } from "../services/githubTreePush.js";

export const githubRouter = router({
  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const conn = await getGithubConnection(ctx.user.id);
    return {
      connected: !!conn?.accessToken,
      username: conn?.githubUsername ?? null,
    };
  }),

  connectUrl: protectedProcedure.query(({ ctx }) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) return { url: null };
    const state = Buffer.from(JSON.stringify({ userId: ctx.user.id })).toString(
      "base64",
    );
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&state=${state}`;
    return { url };
  }),

  pushToRepo: protectedProcedure
    .input(z.object({ projectId: z.number(), repoName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const conn = await getGithubConnection(ctx.user.id);
      if (!conn?.accessToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "GitHub not connected",
        });
      }
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      const files = await getProjectFiles(input.projectId);
      if (Object.keys(files).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No generated files to export. Complete a build first.",
        });
      }

      const owner = conn.githubUsername;
      if (!owner) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub username not available on connection.",
        });
      }

      const { repoUrl } = await pushFilesToGitHubRepo({
        token: conn.accessToken,
        owner,
        repoName: input.repoName,
        files,
        description: (project.description ?? "").slice(0, 200),
      });

      return { repoUrl };
    }),
});
