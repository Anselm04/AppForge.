import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getGithubConnection, getProjectById } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { pushFilesToGitHubRepo } from "../services/githubTreePush.js";
import { createGithubOAuthState } from "../lib/githubOAuthState.js";
import { revealGithubAccessToken } from "../lib/githubTokenCrypto.js";
import { detectStackFromFiles } from "../lib/stackDetection.js";
import { resolveProjectStack } from "../lib/projectStack.js";

async function fetchRepoFiles(
  token: string,
  owner: string,
  repo: string,
): Promise<Record<string, string>> {
  // Resolve the actual default branch rather than assuming main or master.
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  const metadata = await fetch(base, { headers });
  if (!metadata.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Could not read GitHub repository metadata.",
    });
  }
  const details = (await metadata.json()) as { default_branch?: unknown };
  if (
    typeof details.default_branch !== "string" ||
    !details.default_branch.trim()
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Repository default branch is missing.",
    });
  }
  const treeResponse = await fetch(
    `${base}/git/trees/${encodeURIComponent(details.default_branch)}?recursive=1`,
    { headers },
  );
  if (!treeResponse.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Could not read the repository's default-branch tree.",
    });
  }
  const treeJson = (await treeResponse.json()) as {
    truncated?: boolean;
    tree?: Array<{ path?: string; type?: string; size?: number }>;
  };
  if (treeJson.truncated || !Array.isArray(treeJson.tree)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Repository tree is incomplete; import refused.",
    });
  }
  return collectBlobFiles(token, base, { tree: treeJson.tree });
}

async function collectBlobFiles(
  token: string,
  base: string,
  treeJson: { tree: Array<{ path?: string; type?: string; size?: number }> },
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const blobs = treeJson.tree.filter(
    (node) =>
      node.type === "blob" &&
      node.path &&
      !node.path.startsWith("node_modules/") &&
      (node.size ?? 0) < 200_000,
  );
  if (blobs.length > 150) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Repository has more than 150 importable files; full import is required.",
    });
  }
  for (const node of blobs) {
    const path = node.path as string;
    if (
      path.startsWith("/") ||
      path.includes("\\") ||
      path.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Repository includes an unsafe source path.",
      });
    }
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const raw = await fetch(`${base}/contents/${encodedPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw",
      },
    });
    if (!raw.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Repository source download was incomplete; import refused.",
      });
    }
    files[path] = await raw.text();
  }
  return files;
}

function githubTokenOrThrow(stored: string | null | undefined): string {
  if (!stored) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "GitHub not connected",
    });
  }
  try {
    return revealGithubAccessToken(stored);
  } catch {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "GitHub connection must be refreshed",
    });
  }
}

// prettier-ignore
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
    const state = createGithubOAuthState(ctx.user.id);
    const params = new URLSearchParams({
      client_id: clientId,
      scope: "repo",
      state,
    });
    return {
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    };
  }),

  pushToRepo: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        repoName: z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/),
        visibility: z.enum(["private", "public"]).default("private"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conn = await getGithubConnection(ctx.user.id);
      const token = githubTokenOrThrow(conn?.accessToken);
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      // Export current saved working source, including changes after validation.
      const { getEditableProjectFiles } = await import("../db.js");
      const { isSafeTemplatePath, isSafeTemplateContent } =
        await import("./templateFactory.js");
      const files = await getEditableProjectFiles(input.projectId);
      if (
        Object.entries(files).some(
          ([path, content]) =>
            !isSafeTemplatePath(path) || !isSafeTemplateContent(content),
        )
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "The saved source includes a sensitive path or credential. Remove the secret before exporting to GitHub.",
        });
      }
      if (Object.keys(files).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No generated files to export. Complete a build first.",
        });
      }

      const owner = conn?.githubUsername;
      if (!owner) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub username not available on connection.",
        });
      }

      const { repoUrl } = await pushFilesToGitHubRepo({
        token,
        owner,
        repoName: input.repoName,
        private: input.visibility === "private",
        files,
        description: (project.description ?? "").slice(0, 200),
      });

      return { repoUrl };
    }),

  importFromRepo: protectedProcedure
    .input(
      z.object({
        owner: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/),
        repo: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/),
        projectId: z.number().int().positive().optional(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conn = await getGithubConnection(ctx.user.id);
      const token = githubTokenOrThrow(conn?.accessToken);
      const files = await fetchRepoFiles(token, input.owner, input.repo);
      if (Object.keys(files).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No importable files found in repository.",
        });
      }

      // The imported repository keeps its own stack. Unsupported repositories
      // are refused instead of being recorded (and later edited) as React.
      const detected = detectStackFromFiles(files);
      if (!detected.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot import ${input.owner}/${input.repo}: ${detected.reason}`,
        });
      }

      const { createProject, updateProjectFiles } = await import("../db.js");
      let projectId = input.projectId;
      if (!projectId) {
        projectId = await createProject({
          userId: ctx.user.id,
          title: input.title ?? input.repo,
          description: `Imported from GitHub ${input.owner}/${input.repo}`,
          techStack: detected.stack,
          status: "pending",
        });
      } else {
        const project = await getProjectById(projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const projectStack = resolveProjectStack(project).techStack;
        if (projectStack !== detected.stack) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Repository ${input.owner}/${input.repo} uses ${detected.stack} (${detected.reason}) but this project uses ${projectStack}. Import it as a new project instead.`,
          });
        }
      }
      // Imported files are source, not a completed validated application.
      // Persist source and its non-certified lifecycle atomically.
      await updateProjectFiles(projectId, files, { markImported: true });
      return {
        projectId,
        fileCount: Object.keys(files).length,
        techStack: detected.stack,
      };
    }),
});
