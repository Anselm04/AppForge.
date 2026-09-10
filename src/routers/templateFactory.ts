import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import {
  createProject,
  getProjectById,
  getProjectFiles,
  updateProjectFiles,
} from "../db.js";
import { sanitizeArtifactName } from "../services/artifactEngine.js";

const SECRET_PATH_SEGMENTS = [
  "credentials.json",
  "credentials.yml",
  "credentials.yaml",
  "service-account.json",
  "service_account.json",
  "secrets.json",
  "secrets.yml",
  "secrets.yaml",
  ".npmrc",
  ".pypirc",
  ".netrc",
];

const SECRET_CONTENT_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bsk_live_[A-Za-z0-9]+\b/,
  /\bwhsec_[A-Za-z0-9]+\b/,
  /\bgithub_pat_[A-Za-z0-9_]+\b/,
  /\bghp_[A-Za-z0-9]+\b/,
  /\bxox[baprs]-[A-Za-z0-9-]+\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|TWILIO_AUTH_TOKEN|GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY)\s*[=:]\s*["']?(?!your-|replace-|example|test-|\$\{|<)[^\s"']{12,}/i,
];

export function isSafeTemplatePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("..")) return false;
  if (normalized.startsWith("node_modules/")) return false;
  if (normalized.startsWith(".git/")) return false;
  if (normalized === ".env") return false;
  if (normalized.startsWith(".env.") && normalized !== ".env.example") {
    return false;
  }
  if (/\.(pem|key|p12|pfx|jks)$/i.test(normalized)) return false;
  if (
    SECRET_PATH_SEGMENTS.some(
      (segment) =>
        normalized === segment || normalized.endsWith(`/${segment}`),
    )
  ) {
    return false;
  }
  return true;
}

export function isSafeTemplateContent(content: string): boolean {
  const sample = content.slice(0, 500_000);
  return !SECRET_CONTENT_PATTERNS.some((pattern) => pattern.test(sample));
}

export function safeTemplateFiles(
  files: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).filter(
      ([path, content]) =>
        isSafeTemplatePath(path) && isSafeTemplateContent(content),
    ),
  );
}

async function requireCompletedOwnedProject(projectId: number, userId: number) {
  const project = await getProjectById(projectId);
  if (!project || project.userId !== userId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }
  if (project.status !== "completed") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Only completed projects can become templates",
    });
  }
  return project;
}

export const templateFactoryRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2_000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireCompletedOwnedProject(
        input.projectId,
        ctx.user.id,
      );
      const files = safeTemplateFiles(await getProjectFiles(input.projectId));
      if (Object.keys(files).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Project has no safe files to package as a template",
        });
      }

      const templateId = `${input.projectId}-${Date.now()}`;
      const safeName = sanitizeArtifactName(input.name, "template");
      const manifestPath = `artifacts/templates/${safeName}-${templateId}.template.json`;
      const manifest = {
        schemaVersion: 1,
        templateId,
        sourceProjectId: input.projectId,
        name: input.name,
        description: input.description,
        techStack: project.techStack ?? "react-node",
        createdAt: new Date().toISOString(),
        filePaths: Object.keys(files).sort(),
      };

      await updateProjectFiles(input.projectId, {
        ...(await getProjectFiles(input.projectId)),
        [manifestPath]: JSON.stringify(manifest, null, 2),
      });

      return {
        ...manifest,
        manifestPath,
        fileCount: Object.keys(files).length,
      };
    }),

  clone: protectedProcedure
    .input(
      z.object({
        sourceProjectId: z.number().int().positive(),
        title: z.string().trim().min(1).max(255),
        description: z.string().trim().max(4_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const source = await requireCompletedOwnedProject(
        input.sourceProjectId,
        ctx.user.id,
      );
      const sourceFiles = safeTemplateFiles(
        await getProjectFiles(input.sourceProjectId),
      );
      if (Object.keys(sourceFiles).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Template source has no reusable files",
        });
      }

      const projectId = await createProject({
        userId: ctx.user.id,
        title: input.title,
        description:
          input.description ??
          `Created from reusable AppForge project template ${input.sourceProjectId}`,
        techStack: source.techStack ?? "react-node",
        status: "pending",
        locale: source.locale ?? "en",
        buildCapabilities: Array.isArray(source.buildCapabilities)
          ? source.buildCapabilities
          : [],
      });

      await updateProjectFiles(projectId, {
        ...sourceFiles,
        "TEMPLATE_SOURCE.md": `# Template Source\n\nCloned from AppForge project ${input.sourceProjectId}.\n`,
      });

      return {
        projectId,
        sourceProjectId: input.sourceProjectId,
        fileCount: Object.keys(sourceFiles).length,
      };
    }),
});
