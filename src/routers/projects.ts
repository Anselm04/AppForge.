import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  countBuildsThisMonth,
  createProject,
  getAgentLogsByProject,
  getProjectById,
  getProjectsByUserId,
  isUserPro,
  getUserTier,
  getTierBuildLimit,
  updateProjectStatus,
  ensureUserCredits,
} from "../db.js";
import { BUILD_CREDIT_COST, SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";
import { PROMPT_MAX_CHARS } from "../lib/prompt.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import * as schema from "../db/schema.js";
import { db } from "../db.js";
import {
  createSeniorDevTask,
  getSeniorDevTaskById,
  updateSeniorDevTask,
} from "../db.js";

const FREE_TIER_LIMIT = 3;

// ── Validated tech stack options ──
const techStackEnum = z.enum([
  // Web apps
  "react-node",
  "react-python",
  "vue-node",
  "svelte-node",
  "next-node",
  "angular-node",
  "vanilla-node",
  "react-django",
  "react-supabase",
  "remix-node",
  "astro-node",
  // Games
  "phaser-html5",
  "three-js-3d",
  "babylon-js-3d",
  "unity-webgl",
  "godot-html5",
  "react-native-game",
  "flutter-game",
  // AI / Agents
  "ai-agent-python",
  "ai-agent-node",
  "openai-tool",
  "langchain-tool",
  "crewai-agent",
  "autogen-agent",
  // Desktop / Mobile
  "electron-react",
  "tauri-rust",
  "react-native-expo",
  "flutter-firebase",
  "capacitor-ionic",
  // Specialized
  "chrome-extension",
  "vscode-extension",
  "discord-bot",
  "telegram-bot",
  "slack-bot",
  "browser-automation",
  "web-scraper",
  "data-visualization",
  "api-service",
  "serverless-aws",
  "serverless-vercel",
]);

// ── Input sanitization helpers ──
function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, "").slice(0, PROMPT_MAX_CHARS);
}

const projectCreateSchema = z.object({
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(
      PROMPT_MAX_CHARS,
      `Description must be at most ${PROMPT_MAX_CHARS} characters`,
    )
    .transform(sanitizeString),
  techStack: techStackEnum.default("react-node"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be at most 255 characters")
    .transform(sanitizeString),
  hcaptchaToken: z.string().optional(),
});

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getProjectsByUserId(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      if (project.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      return project;
    }),

  getLogs: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      if (project.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      return getAgentLogsByProject(input.projectId);
    }),

  create: protectedProcedure
    .input(projectCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { verifyHcaptchaToken } = await import("../lib/hcaptcha.js");
      const captchaOk = await verifyHcaptchaToken(input.hcaptchaToken);
      if (!captchaOk) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Captcha verification failed. Complete the challenge and try again.",
        });
      }

      // ── Content moderation ──
      const { moderateUserContent } = await import("./moderation.js");
      const moderation = await moderateUserContent(
        ctx.user.id,
        input.description + " " + input.title,
      );
      if (!moderation.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: moderation.reason ?? "Content flagged",
        });
      }

      // Backend tier enforcement
      const tier = await getUserTier(ctx.user.id);
      const limit = getTierBuildLimit(tier);
      if (limit !== null) {
        const buildsThisMonth = await countBuildsThisMonth(ctx.user.id);
        if (buildsThisMonth >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Tier limit reached (${limit} builds/month on ${tier} plan). Upgrade for more builds.`,
          });
        }
      }

      const credits = await ensureUserCredits(ctx.user.id);
      const unlimited = !!credits.unlimited || credits.tier === "lifetime";
      if (!unlimited && credits.balance < BUILD_CREDIT_COST) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `credits_exhausted: Out of credits (${credits.balance}/${BUILD_CREDIT_COST}). Subscribe or buy extra credits to start a build.`,
        });
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
    const tier = await getUserTier(ctx.user.id);
    const isPaid = await isUserPro(ctx.user.id);
    const buildsThisMonth = await countBuildsThisMonth(ctx.user.id);
    const { getUserCredits } = await import("../db.js");
    const credits = await getUserCredits(ctx.user.id);
    const limit = getTierBuildLimit(tier);
    return {
      tier,
      isPaid,
      buildsThisMonth,
      limit,
      remaining: limit !== null ? Math.max(0, limit - buildsThisMonth) : null,
      credits: credits?.balance ?? 0,
      unlimited: !!credits?.unlimited || tier === "lifetime",
    };
  }),

  deploy: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        destination: z
          .enum(["vercel", "netlify", "fly", "preview", "zip", "github-pages"])
          .default("preview"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      const deployableStatuses = new Set(["completed", "paused", "failed"]);
      if (!project.status || !deployableStatuses.has(project.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Project not ready for deployment (still building or cancelled)",
        });
      }

      const { getCurrentSnapshot } = await import("../db.js");
      const snapshot = await getCurrentSnapshot(input.id);
      const files =
        (snapshot?.files as Record<string, string> | null) ??
        (project.generatedFiles as Record<string, string> | null) ??
        {};
      if (Object.keys(files).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No generated files to deploy",
        });
      }

      const { deployProject, zipFiles, listDeployDestinations } =
        await import("../services/deployer.js");

      if (input.destination === "zip") {
        const { base64, filename } = await zipFiles(
          project.title || "appforge-app",
          files,
        );
        return {
          deployUrl: null as string | null,
          destination: "zip" as const,
          base64,
          filename,
        };
      }

      const origin =
        process.env.CORS_ORIGIN ||
        process.env.APP_URL ||
        "https://appforge-unfurling-moon-9058.fly.dev";

      try {
        const result = await deployProject({
          destination: input.destination,
          projectName: project.title || "appforge-app",
          files,
          projectId: input.id,
          previewBaseUrl: origin.replace(/\/$/, ""),
        });

        if (input.destination === "preview" && result.url) {
          const { watchProject } = await import("../agents/selfHealing.js");
          watchProject(input.id, ctx.user.id, result.url);
        }

        await db
          .update(schema.projects)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(schema.projects.id, input.id));

        return {
          deployUrl: result.url,
          destination: result.destination,
          note: result.note,
          options: listDeployDestinations(),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Deploy failed";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  deployOptions: protectedProcedure.query(async () => {
    const { listDeployDestinations } = await import("../services/deployer.js");
    return listDeployDestinations();
  }),

  download: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      const { getCurrentSnapshot } = await import("../db.js");
      const snapshot = await getCurrentSnapshot(input.id);
      const files =
        (snapshot?.files as Record<string, string> | null) ??
        (project.generatedFiles as Record<string, string> | null) ??
        {};
      if (Object.keys(files).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No generated files to download",
        });
      }
      const { zipFiles } = await import("../services/deployer.js");
      const { base64, filename } = await zipFiles(
        project.title || "appforge-app",
        files,
      );
      return { base64, filename };
    }),

  // ── Senior Dev Agent: Create Task ──
  seniorDev: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        request: z.string().min(5).max(5000),
        mode: z.enum(["collaborative", "autonomous"]).default("collaborative"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      const seniorCredits = await ensureUserCredits(ctx.user.id);
      if (seniorCredits.balance < SENIOR_DEV_CREDIT_COST) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `credits_exhausted: Out of credits (${seniorCredits.balance}/${SENIOR_DEV_CREDIT_COST}). Subscribe or buy extra credits to use the Senior Dev Agent.`,
        });
      }

      const taskId = await createSeniorDevTask({
        projectId: input.projectId,
        userId: ctx.user.id,
        request: input.request,
        mode: input.mode,
      });

      return { taskId, status: "planning" };
    }),

  // ── Senior Dev Agent: Approve Plan ──
  seniorDevApprove: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const task = await getSeniorDevTaskById(input.taskId);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      if (task.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      if (task.status !== "awaiting_approval") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Task not awaiting approval",
        });
      }

      await updateSeniorDevTask(input.taskId, {
        planApproved: true,
        status: "executing",
      });
      return { success: true, status: "executing" };
    }),

  // ── Senior Dev Agent: Get Task ──
  seniorDevTask: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const task = await getSeniorDevTaskById(input.taskId);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      if (task.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      return task;
    }),

  /** List all build snapshots for a project (version history) */
  snapshots: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const { getSnapshotsByProject } = await import("../db.js");
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return getSnapshotsByProject(input.projectId);
    }),

  /** Rollback to a specific snapshot version */
  rollback: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        snapshotId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { getSnapshotById, markSnapshotAsCurrent, updateProjectFiles } =
        await import("../db.js");
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      const snapshot = await getSnapshotById(input.snapshotId);
      if (!snapshot || snapshot.projectId !== input.projectId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Snapshot not found",
        });
      }
      await markSnapshotAsCurrent(input.snapshotId, input.projectId);
      await updateProjectFiles(
        input.projectId,
        snapshot.files as Record<string, string>,
      );
      return {
        success: true,
        version: snapshot.version,
        label: snapshot.label,
      };
    }),
});
