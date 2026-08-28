import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc.js";
import { invokeLLM } from "../_core/llm.js";
import { modelForAgent } from "../lib/llmModels.js";
import { searchWeb } from "../services/webSearch.js";
import {
  BUILD_CAPABILITY_IDS,
  BUILD_CAPABILITIES,
} from "../lib/buildCapabilities.js";
import { architectureProcedures } from "./architectureProcedures.js";

export const capabilitiesRouter = router({
  list: protectedProcedure.query(() => {
    return Object.values(BUILD_CAPABILITIES);
  }),

  webSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2).max(500),
        maxResults: z.number().int().min(1).max(10).default(6),
      }),
    )
    .mutation(async ({ input }) => {
      return searchWeb(input.query, input.maxResults);
    }),

  generateMarketing: protectedProcedure
    .input(
      z.object({
        product: z.string().min(5).max(2000),
        goal: z.enum(["traffic", "leads", "sales"]).default("leads"),
        channels: z
          .array(z.enum(["landing", "email", "social", "seo", "ads"]))
          .default(["landing", "social"]),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: modelForAgent("planner"),
        messages: [
          {
            role: "system",
            content: `You are an expert growth marketer. Generate actionable marketing assets focused on ${input.goal}.
Output valid JSON: { "headline", "subheadline", "cta", "landingSections": [{title, body}], "emailSubject", "emailBody", "socialPosts": [string], "seoKeywords": [string], "adVariants": [{headline, body}] }`,
          },
          {
            role: "user",
            content: `Product/app: ${input.product}\nChannels: ${input.channels.join(", ")}`,
          },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
      } catch {
        return { raw: text };
      }
    }),

  generateLyrics: protectedProcedure
    .input(
      z.object({
        theme: z.string().min(3).max(500),
        genre: z.string().max(100).default("pop"),
        mood: z.string().max(100).default("uplifting"),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: modelForAgent("coder"),
        messages: [
          {
            role: "system",
            content:
              "Write original song lyrics. Output JSON: { title, bpm, key, structure: [{section, lines: [string]}] }",
          },
          {
            role: "user",
            content: `Theme: ${input.theme}\nGenre: ${input.genre}\nMood: ${input.mood}`,
          },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { lyrics: text };
      } catch {
        return { lyrics: text };
      }
    }),

  generateVideoStoryboard: protectedProcedure
    .input(
      z.object({
        concept: z.string().min(5).max(2000),
        durationSec: z.number().int().min(5).max(180).default(30),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: modelForAgent("planner"),
        messages: [
          {
            role: "system",
            content: `Create a video storyboard. Output JSON: { title, durationSec, scenes: [{ id, startSec, endSec, visual, narration, onScreenText }] }`,
          },
          {
            role: "user",
            content: `Concept: ${input.concept}\nTarget duration: ${input.durationSec}s`,
          },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
      } catch {
        return { raw: text };
      }
    }),

  researchEducation: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        audience: z.string().max(200).default("general"),
      }),
    )
    .mutation(async ({ input }) => {
      const query = `${input.topic} ${input.audience} curriculum lesson plans teaching resources standards`;
      return searchWeb(query, 8);
    }),

  generateCourse: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(3).max(500),
        audience: z.string().max(200).default("high school"),
        moduleCount: z.number().int().min(2).max(12).default(6),
      }),
    )
    .mutation(async ({ input }) => {
      const research = await searchWeb(
        `${input.subject} ${input.audience} curriculum syllabus 2026`,
        5,
      );
      const researchContext = research.results
        .slice(0, 3)
        .map((r) => r.snippet)
        .join("\n");
      const result = await invokeLLM({
        model: modelForAgent("planner"),
        messages: [
          {
            role: "system",
            content: `Design a complete online course. Use current educational best practices.
Output JSON: { title, description, learningObjectives: [string], modules: [{ id, title, lessons: [{ id, title, durationMin, activities: [string], assessmentType }] }], prerequisites: [string] }`,
          },
          {
            role: "user",
            content: `Subject: ${input.subject}\nAudience: ${input.audience}\nModules: ${input.moduleCount}\n\nCurrent web research:\n${researchContext}`,
          },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
        return { ...plan, researchSources: research.results.slice(0, 5) };
      } catch {
        return { raw: text, researchSources: research.results };
      }
    }),

  generateClass: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(3).max(500),
        audience: z.string().max(200).default("high school"),
        durationMin: z.number().int().min(15).max(180).default(50),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: modelForAgent("planner"),
        messages: [
          {
            role: "system",
            content: `Plan a single live teaching session. Output JSON: { title, durationMin, agenda: [{ timeMin, activity, materials }], liveInteractions: [string], homework, arMoments: [{ minute, arObject, purpose }] }`,
          },
          {
            role: "user",
            content: `Subject: ${input.subject}\nAudience: ${input.audience}\nDuration: ${input.durationMin} min`,
          },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
      } catch {
        return { raw: text };
      }
    }),

  generateVirtualClassroom: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(3).max(500),
        features: z
          .array(
            z.enum([
              "whiteboard",
              "3d_models",
              "live_chat",
              "ar_objects",
              "screen_share",
              "breakout_rooms",
            ]),
          )
          .default(["whiteboard", "3d_models", "live_chat", "ar_objects"]),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: modelForAgent("planner"),
        messages: [
          {
            role: "system",
            content: `Design an AR-enhanced virtual classroom. Output JSON: {
  title, platform: "webxr"|"arjs",
  roomLayout: { seats, presenterPosition },
  whiteboard: { syncMode, tools: [string] },
  arObjects: [{ id, label, modelType, interaction }],
  liveFeatures: [string],
  studentInteractions: [string],
  fallback2D: { description }
}`,
          },
          {
            role: "user",
            content: `Subject: ${input.subject}\nFeatures: ${input.features.join(", ")}`,
          },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
      } catch {
        return { raw: text };
      }
    }),

  generateARScene: protectedProcedure
    .input(
      z.object({
        description: z.string().min(5).max(2000),
        platform: z.enum(["webxr", "arjs", "model-viewer"]).default("webxr"),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: modelForAgent("planner"),
        messages: [
          {
            role: "system",
            content: `Design an AR experience plan. Output JSON: { title, platform, anchors: [{type, label, modelUrl}], uiOverlays: [string], instructions: [string], fallback3D: boolean }`,
          },
          { role: "user", content: input.description },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
      } catch {
        return { raw: text };
      }
    }),

  searchPriorArt: protectedProcedure
    .input(
      z.object({
        concept: z.string().min(5).max(2000),
        jurisdiction: z
          .enum(["USPTO", "IPONZ", "EPO", "IP_AUSTRALIA", "UK_IPO", "CIPO"])
          .default("USPTO"),
      }),
    )
    .mutation(async ({ input }) => {
      const query = `${input.concept} prior art patent ${input.jurisdiction} similar products`;
      return searchWeb(query, 8);
    }),

  generateInventionDesign: protectedProcedure
    .input(
      z.object({
        concept: z.string().min(10).max(5000),
        priorArtSummary: z.string().max(8000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: modelForAgent("planner"),
        messages: [
          {
            role: "system",
            content: `You are an invention design engineer. Expand the concept into a complete technical invention.
Output JSON: {
  title, problemSolved, components: [{ id, name, function, material }],
  interactions: [{ from, to, mechanism }],
  noveltyPoints: [string],
  embodiments: [string],
  referenceNumerals: [{ numeral, label }]
}`,
          },
          {
            role: "user",
            content: `Concept: ${input.concept}\n${input.priorArtSummary ? `Prior art notes:\n${input.priorArtSummary}` : ""}`,
          },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
      } catch {
        return { raw: text };
      }
    }),

  generatePatentSpecification: protectedProcedure
    .input(
      z.object({
        inventionDesign: z.record(z.unknown()),
        jurisdiction: z
          .enum(["USPTO", "IPONZ", "EPO", "IP_AUSTRALIA", "UK_IPO", "CIPO"])
          .default("USPTO"),
        filingType: z
          .enum(["provisional", "complete", "non_provisional"])
          .optional(),
        priorArtSummary: z.string().max(8000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { PATENT_JURISDICTIONS, resolveFilingType } =
        await import("../lib/patentJurisdictions.js");
      const meta = PATENT_JURISDICTIONS[input.jurisdiction];
      const filing = resolveFilingType(input.jurisdiction, input.filingType);
      const result = await invokeLLM({
        model: modelForAgent("planner"),
        messages: [
          {
            role: "system",
            content: `Draft a patent specification for ${meta.label}, filing type: ${filing}.
Sections required: ${meta.specificationSections.join(", ")}.
Output JSON with keys matching sections (camelCase). Include claims as array of strings.
Enable a skilled person to make and use the invention. ${meta.notes}`,
          },
          {
            role: "user",
            content: `Invention design:\n${JSON.stringify(input.inventionDesign, null, 2)}\n${input.priorArtSummary ?? ""}`,
          },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const spec = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
        return {
          ...spec,
          jurisdiction: input.jurisdiction,
          filingType: filing,
        };
      } catch {
        return {
          raw: text,
          jurisdiction: input.jurisdiction,
          filingType: filing,
        };
      }
    }),

  generatePatentDrawings: protectedProcedure
    .input(
      z.object({
        inventionDesign: z.record(z.unknown()),
        mode: z.enum(["informal", "formal"]).default("informal"),
        figureCount: z.number().int().min(1).max(12).default(4),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: modelForAgent("coder"),
        messages: [
          {
            role: "system",
            content: `Generate patent figure descriptions for ${input.mode} drawings.
Output JSON: { figures: [{ figureNumber, view, elements: [{ refNumeral, label, x, y }], caption }] }
Coordinates are 0-100 percent for canvas placement. Use reference numerals from invention design.`,
          },
          {
            role: "user",
            content: JSON.stringify(input.inventionDesign, null, 2),
          },
        ],
      });
      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch
          ? { ...JSON.parse(jsonMatch[0]), mode: input.mode }
          : { raw: text, mode: input.mode };
      } catch {
        return { raw: text, mode: input.mode };
      }
    }),

  checkPatentReferences: protectedProcedure
    .input(
      z.object({
        specification: z.string().min(1).max(200_000),
        drawingLabels: z.string().min(1).max(50_000),
      }),
    )
    .mutation(async ({ input }) => {
      const { checkReferenceNumerals } =
        await import("../lib/patentReferenceCheck.js");
      return checkReferenceNumerals(input.specification, input.drawingLabels);
    }),

  ...architectureProcedures,

  attachStudioAsset: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        filename: z.string().min(1).max(200),
        content: z.string().max(2_000_000),
        kind: z.enum([
          "video",
          "audio",
          "graphics",
          "marketing",
          "ar",
          "education",
          "patent",
          "architecture",
          "research",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { getProjectById, getProjectFiles, updateProjectFiles } =
        await import("../db.js");
      const project = await getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const files = await getProjectFiles(input.projectId);
      const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const prefix =
        input.kind === "graphics"
          ? "public/assets/"
          : input.kind === "video"
            ? "public/video/"
            : input.kind === "audio"
              ? "public/audio/"
              : input.kind === "ar"
                ? "public/ar/"
                : input.kind === "education"
                  ? "education/"
                  : input.kind === "patent"
                    ? "patent/"
                    : input.kind === "architecture"
                      ? "architecture/"
                      : input.kind === "marketing"
                        ? "marketing/"
                        : "research/";
      const path = `${prefix}${safeName}`;
      files[path] = input.content;
      await updateProjectFiles(input.projectId, files);
      return { path, ok: true };
    }),
});

export type CapabilitiesRouter = typeof capabilitiesRouter;
