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
  updateProjectFiles,
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

const techStackEnum = z.enum([
  "react-node", "react-python", "vue-node", "svelte-node", "next-node",
  "angular-node", "vanilla-node", "react-django", "react-supabase", "remix-node",
  "astro-node", "phaser-html5", "three-js-3d", "babylon-js-3d", "unity-webgl",
  "godot-html5", "react-native-game", "flutter-game", "ai-agent-python", "ai-agent-node",
  "openai-tool", "langchain-tool", "crewai-agent", "autogen-agent", "electron-react",
  "tauri-rust", "react-native-expo", "flutter-firebase", "capacitor-ionic", "chrome-extension",
  "vscode-extension", "discord-bot", "telegram-bot", "slack-bot", "browser-automation",
  "web-scraper", "data-visualization", "api-service", "serverless-aws", "serverless-vercel",
]);

function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, "").slice(0, PROMPT_MAX_CHARS);
}

const projectCreateSchema = z.object({
  description: z.string().min(10).max(PROMPT_MAX_CHARS).transform(sanitizeString),
  techStack: techStackEnum.default("react-node"),
  title: z.string().min(1).max(255).transform(sanitizeString),
  hcaptchaToken: z.string().optional(),
  locale: z.string().max(10).optional(),
});

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => getProjectsByUserId(ctx.user.id)),
  getFiles: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.id);
    if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    const { getProjectFiles } = await import("../db.js");
    return getProjectFiles(input.id);
  }),
  updateFile: protectedProcedure.input(z.object({ id: z.number().int().positive(), path: z.string().min(1).max(500), content: z.string().max(500_000) })).mutation(async ({ ctx, input }) => {
    const project = await getProjectById(input.id);
    if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    const { getProjectFiles } = await import("../db.js");
    const files = await getProjectFiles(input.id);
    files[input.path] = input.content;
    await updateProjectFiles(input.id, files);
    return { ok: true, path: input.path };
  }),
});
