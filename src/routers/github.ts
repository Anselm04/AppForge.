import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getGithubConnection, getProjectById } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

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
      "base64"
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

      const files = (project.generatedFiles as Record<string, string>) ?? {};

      const createRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          name: input.repoName,
          description: (project.description || "").slice(0, 200),
          private: true,
          auto_init: true,
        }),
      });

      if (!createRes.ok && createRes.status !== 422) {
        const err = await createRes.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `GitHub repo creation failed: ${err}`,
        });
      }

      const repoData =
        createRes.status === 422
          ? { full_name: `${conn.githubUsername}/${input.repoName}` }
          : await createRes.json();

      const failures: string[] = [];
      for (const [path, content] of Object.entries(files)) {
        const encoded = Buffer.from(content).toString("base64");
        const putRes = await fetch(
          `https://api.github.com/repos/${repoData.full_name}/contents/${encodeURIComponent(path)}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${conn.accessToken}`,
              "Content-Type": "application/json",
              Accept: "application/vnd.github+json",
            },
            body: JSON.stringify({
              message: `feat: add ${path} via AppForge`,
              content: encoded,
            }),
          }
        );
        if (!putRes.ok) {
          failures.push(`${path}: ${putRes.status}`);
        }
      }

      if (failures.length > 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Repo created but some files failed to push: ${failures.join("; ")}`,
        });
      }

      return { repoUrl: `https://github.com/${repoData.full_name}` };
    }),
});
