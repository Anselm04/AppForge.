import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getGithubConnection, getProjectById, getProjectFiles } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { pushFilesToGitHubRepo } from "../services/githubTreePush.js";

async function fetchRepoFiles(
  token: string,
  owner: string,
  repo: string,
): Promise<Record<string, string>> {
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!treeRes.ok) {
    const masterRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    if (!masterRes.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Could not read repository tree (main/master).",
      });
    }
    return collectBlobFiles(
      token,
      owner,
      repo,
      (await masterRes.json()) as {
        tree?: Array<{ path?: string; type?: string; size?: number }>;
      },
    );
  }
  return collectBlobFiles(
    token,
    owner,
    repo,
    (await treeRes.json()) as {
      tree?: Array<{ path?: string; type?: string; size?: number }>;
    },
  );
}

async function collectBlobFiles(
  token: string,
  owner: string,
  repo: string,
  treeJson: { tree?: Array<{ path?: string; type?: string; size?: number }> },
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const blobs = (treeJson.tree ?? []).filter(
    (n) =>
      n.type === "blob" &&
      n.path &&
      !n.path.includes("node_modules/") &&
      (n.size ?? 0) < 200_000,
  );
  for (const node of blobs.slice(0, 150)) {
    const raw = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${node.path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.raw",
        },
      },
    );
    if (raw.ok) {
      files[node.path!] = await raw.text();
    }
  }
  return files;
}

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

  importFromRepo: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        projectId: z.number().int().positive().optional(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conn = await getGithubConnection(ctx.user.id);
      if (!conn?.accessToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "GitHub not connected",
        });
      }
      const files = await fetchRepoFiles(
        conn.accessToken,
        input.owner,
        input.repo,
      );
      if (Object.keys(files).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No importable files found in repository.",
        });
      }

      const { createProject, updateProjectFiles } = await import("../db.js");
      let projectId = input.projectId;
      if (!projectId) {
        projectId = await createProject({
          userId: ctx.user.id,
          title: input.title ?? input.repo,
          description: `Imported from GitHub ${input.owner}/${input.repo}`,
          techStack: "react-node",
          status: "completed",
        });
      } else {
        const project = await getProjectById(projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      await updateProjectFiles(projectId, files);
      return { projectId, fileCount: Object.keys(files).length };
    }),
});
