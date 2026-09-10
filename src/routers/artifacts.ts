import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { invokeLLM } from "../_core/llm.js";
import { getProjectById, getProjectFiles } from "../db.js";
import { modelForAgent } from "../lib/llmModels.js";
import {
  createCsv,
  createDocumentHtml,
  createPresentationHtml,
  createSimplePdf,
  extractPdfText,
  sanitizeArtifactName,
  saveProjectArtifact,
} from "../services/artifactEngine.js";

async function requireOwnedProject(projectId: number, userId: number) {
  const project = await getProjectById(projectId);
  if (!project || project.userId !== userId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }
  return project;
}

async function requireCompletedProject(projectId: number, userId: number) {
  const project = await requireOwnedProject(projectId, userId);
  if (project.status !== "completed") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Artifacts can only be added after the project build is complete",
    });
  }
  return project;
}

function validateArtifactPath(path: string) {
  if (!path.startsWith("artifacts/") || path.includes("..")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid artifact path",
    });
  }
}

async function readOwnedArtifact(
  projectId: number,
  userId: number,
  path: string,
): Promise<string> {
  await requireOwnedProject(projectId, userId);
  validateArtifactPath(path);
  const files = await getProjectFiles(projectId);
  const content = files[path];
  if (content === undefined) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Artifact not found",
    });
  }
  return content;
}

function artifactMimeType(path: string): string {
  if (path.endsWith(".pdf.base64")) return "application/pdf";
  if (path.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  return "text/markdown; charset=utf-8";
}

function normalizeArtifactForAnalysis(path: string, content: string): string {
  if (path.endsWith(".pdf.base64")) {
    return extractPdfText(Buffer.from(content, "base64"));
  }
  if (path.endsWith(".html")) {
    return content
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return content;
}

const projectInput = z.object({ projectId: z.number().int().positive() });
const artifactPath = z.string().min(1).max(240);

export const artifactsRouter = router({
  list: protectedProcedure.input(projectInput).query(async ({ ctx, input }) => {
    await requireOwnedProject(input.projectId, ctx.user.id);
    const files = await getProjectFiles(input.projectId);
    return Object.keys(files)
      .filter((path) => path.startsWith("artifacts/"))
      .sort();
  }),

  read: protectedProcedure
    .input(projectInput.extend({ path: artifactPath }))
    .query(async ({ ctx, input }) => {
      const content = await readOwnedArtifact(
        input.projectId,
        ctx.user.id,
        input.path,
      );
      return {
        path: input.path,
        encoding: input.path.endsWith(".pdf.base64") ? "base64" : "utf8",
        mimeType: artifactMimeType(input.path),
        content,
      };
    }),

  createDocument: protectedProcedure
    .input(
      projectInput.extend({
        filename: z.string().min(1).max(120),
        title: z.string().min(1).max(255),
        content: z.string().max(200_000),
        format: z.enum(["markdown", "html"]).default("markdown"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireCompletedProject(input.projectId, ctx.user.id);
      const name = sanitizeArtifactName(input.filename, "document");
      const extension = input.format === "html" ? "html" : "md";
      const path = `artifacts/documents/${name}.${extension}`;
      const content =
        input.format === "html"
          ? createDocumentHtml({ title: input.title, content: input.content })
          : `# ${input.title}\n\n${input.content}\n`;
      return saveProjectArtifact({
        projectId: input.projectId,
        path,
        content,
      });
    }),

  createSpreadsheet: protectedProcedure
    .input(
      projectInput.extend({
        filename: z.string().min(1).max(120),
        headers: z.array(z.string().max(255)).min(1).max(100),
        rows: z
          .array(
            z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
          )
          .max(10_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireCompletedProject(input.projectId, ctx.user.id);
      if (input.rows.some((row) => row.length > input.headers.length)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Spreadsheet rows contain more cells than headers",
        });
      }
      const name = sanitizeArtifactName(input.filename, "spreadsheet");
      const path = `artifacts/spreadsheets/${name}.csv`;
      const content = createCsv(input.headers, input.rows);
      if (Buffer.byteLength(content, "utf8") > 2_000_000) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Spreadsheet is too large",
        });
      }
      return saveProjectArtifact({
        projectId: input.projectId,
        path,
        content,
      });
    }),

  createPresentation: protectedProcedure
    .input(
      projectInput.extend({
        filename: z.string().min(1).max(120),
        title: z.string().min(1).max(255),
        slides: z
          .array(
            z.object({
              title: z.string().min(1).max(255),
              body: z.string().max(4_000).optional(),
              bullets: z.array(z.string().max(1_000)).max(20).optional(),
            }),
          )
          .min(1)
          .max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireCompletedProject(input.projectId, ctx.user.id);
      const name = sanitizeArtifactName(input.filename, "presentation");
      const path = `artifacts/presentations/${name}.html`;
      const content = createPresentationHtml({
        title: input.title,
        slides: input.slides,
      });
      return saveProjectArtifact({
        projectId: input.projectId,
        path,
        content,
      });
    }),

  createPdf: protectedProcedure
    .input(
      projectInput.extend({
        filename: z.string().min(1).max(120),
        title: z.string().min(1).max(255),
        lines: z.array(z.string().max(2_000)).min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireCompletedProject(input.projectId, ctx.user.id);
      const name = sanitizeArtifactName(input.filename, "report");
      const path = `artifacts/pdf/${name}.pdf.base64`;
      const pdf = createSimplePdf({ title: input.title, lines: input.lines });
      const content = pdf.toString("base64");
      const stored = await saveProjectArtifact({
        projectId: input.projectId,
        path,
        content,
      });
      return {
        ...stored,
        downloadFilename: `${name}.pdf`,
      };
    }),

  importPdf: protectedProcedure
    .input(
      projectInput.extend({
        filename: z.string().min(1).max(120),
        base64: z.string().min(8).max(7_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireCompletedProject(input.projectId, ctx.user.id);
      const pdf = Buffer.from(input.base64, "base64");
      if (pdf.length === 0 || pdf.length > 5_000_000) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "PDF must be 5 MB or smaller",
        });
      }
      try {
        extractPdfText(pdf);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid PDF file",
        });
      }
      const name = sanitizeArtifactName(input.filename, "imported-pdf");
      const path = `artifacts/pdf/${name}.pdf.base64`;
      return saveProjectArtifact({
        projectId: input.projectId,
        path,
        content: pdf.toString("base64"),
      });
    }),

  extractPdf: protectedProcedure
    .input(projectInput.extend({ path: artifactPath }))
    .query(async ({ ctx, input }) => {
      if (!input.path.endsWith(".pdf.base64")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Artifact is not a PDF",
        });
      }
      const content = await readOwnedArtifact(
        input.projectId,
        ctx.user.id,
        input.path,
      );
      const text = extractPdfText(Buffer.from(content, "base64"));
      return {
        path: input.path,
        text,
        textBasedExtraction: true,
      };
    }),

  analyze: protectedProcedure
    .input(
      projectInput.extend({
        path: artifactPath,
        question: z.string().trim().min(1).max(2_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const content = await readOwnedArtifact(
        input.projectId,
        ctx.user.id,
        input.path,
      );
      let normalized: string;
      try {
        normalized = normalizeArtifactForAnalysis(input.path, content);
      } catch {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "Artifact text could not be extracted",
        });
      }
      if (!normalized) {
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "Artifact contains no extractable text",
        });
      }

      const excerpt = normalized.slice(0, 80_000);
      const result = await invokeLLM({
        model: modelForAgent("planner"),
        messages: [
          {
            role: "system",
            content:
              "Analyze the supplied project artifact carefully. Base the answer only on the artifact content. If the artifact does not support a requested conclusion, say so.",
          },
          {
            role: "user",
            content: `Question: ${input.question}\n\nArtifact (${input.path}):\n${excerpt}`,
          },
        ],
      });
      const answer = result.choices[0]?.message?.content;
      return {
        path: input.path,
        answer: typeof answer === "string" ? answer : "",
        truncated: normalized.length > excerpt.length,
      };
    }),
});
