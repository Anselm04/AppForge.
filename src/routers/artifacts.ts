import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import { getProjectById, getProjectFiles } from "../db.js";
import {
  createCsv,
  createDocumentHtml,
  createPresentationHtml,
  createSimplePdf,
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

const projectInput = z.object({ projectId: z.number().int().positive() });

export const artifactsRouter = router({
  list: protectedProcedure.input(projectInput).query(async ({ ctx, input }) => {
    await requireOwnedProject(input.projectId, ctx.user.id);
    const files = await getProjectFiles(input.projectId);
    return Object.keys(files)
      .filter((path) => path.startsWith("artifacts/"))
      .sort();
  }),

  read: protectedProcedure
    .input(
      projectInput.extend({
        path: z.string().min(1).max(240),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireOwnedProject(input.projectId, ctx.user.id);
      if (!input.path.startsWith("artifacts/") || input.path.includes("..")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid artifact path" });
      }
      const files = await getProjectFiles(input.projectId);
      const content = files[input.path];
      if (content === undefined) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artifact not found" });
      }
      return {
        path: input.path,
        encoding: input.path.endsWith(".pdf.base64") ? "base64" : "utf8",
        mimeType: input.path.endsWith(".pdf.base64")
          ? "application/pdf"
          : input.path.endsWith(".csv")
            ? "text/csv; charset=utf-8"
            : input.path.endsWith(".html")
              ? "text/html; charset=utf-8"
              : "text/markdown; charset=utf-8",
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
      await requireOwnedProject(input.projectId, ctx.user.id);
      const name = sanitizeArtifactName(input.filename, "document");
      const extension = input.format === "html" ? "html" : "md";
      const path = `artifacts/documents/${name}.${extension}`;
      const content =
        input.format === "html"
          ? createDocumentHtml({ title: input.title, content: input.content })
          : `# ${input.title}\n\n${input.content}\n`;
      return saveProjectArtifact({ projectId: input.projectId, path, content });
    }),

  createSpreadsheet: protectedProcedure
    .input(
      projectInput.extend({
        filename: z.string().min(1).max(120),
        headers: z.array(z.string().max(255)).min(1).max(100),
        rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(10_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnedProject(input.projectId, ctx.user.id);
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
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Spreadsheet is too large" });
      }
      return saveProjectArtifact({ projectId: input.projectId, path, content });
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
      await requireOwnedProject(input.projectId, ctx.user.id);
      const name = sanitizeArtifactName(input.filename, "presentation");
      const path = `artifacts/presentations/${name}.html`;
      const content = createPresentationHtml({
        title: input.title,
        slides: input.slides,
      });
      return saveProjectArtifact({ projectId: input.projectId, path, content });
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
      await requireOwnedProject(input.projectId, ctx.user.id);
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
});
