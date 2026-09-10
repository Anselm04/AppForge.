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

function isSafeTemplatePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("..")) return false;
  if (normalized.startsWith("node_modules/")) return false;
  if (normalized.startsWith(".git/")) return false;
  if (normalized === ".env") return false;
  if (normalized.startsWith(".env.") && normalized !== ".env.example") {
    return false;
  }
  if (/\.(pem|key|p12|pfx|jks)$/i.test(normalized)) return false;
  return true;
}

function safeTemplateFiles(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).filter(([path]) => isSafeTemplatePath(path)),
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
