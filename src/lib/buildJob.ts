import { z } from "zod";
import {
  productContractSchema,
  type ProductContract,
  type PromptIntent,
} from "./productContract.js";

const promptIntentSchema = z.object({
  originalPrompt: z.string(),
  primaryProductType: z
    .enum([
      "website",
      "saas_application",
      "mobile_app",
      "desktop_app",
      "game",
      "ai_agent",
      "developer_tool",
      "api",
      "ecommerce_product",
      "browser_extension",
      "automation_tool",
      "data_product",
    ])
    .nullable(),
  secondaryCapabilities: z.array(
    z.enum([
      "authentication",
      "database",
      "billing",
      "ai",
      "analytics",
      "administration",
      "teams",
      "notifications",
      "search",
      "file_uploads",
      "external_integrations",
      "deployment",
    ]),
  ),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(
    z.object({
      productType: z.enum([
        "website",
        "saas_application",
        "mobile_app",
        "desktop_app",
        "game",
        "ai_agent",
        "developer_tool",
        "api",
        "ecommerce_product",
        "browser_extension",
        "automation_tool",
        "data_product",
      ]),
      confidence: z.number().min(0).max(1),
    }),
  ),
  ambiguous: z.boolean(),
  clarificationQuestions: z.array(z.string()),
  canonicalInterpretation: z.string().min(1),
});

export const buildJobSchema = z
  .object({
    projectId: z.number().int().positive(),
    userId: z.number().int().positive(),
    description: z.string().min(1).max(20_000),
    techStack: z.string().min(1).max(120),
    locale: z.string().min(1).max(32).optional(),
    buildCapabilities: z.array(z.string().min(1)).optional(),
    promptIntent: promptIntentSchema.optional(),
    productContract: productContractSchema,
    createdAt: z.string().min(1),
    reservationCharged: z.boolean(),
  })
  .superRefine((job, ctx) => {
    if (job.productContract.originalPrompt !== job.description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productContract", "originalPrompt"],
        message: "Build job original prompt must match the canonical product contract",
      });
    }

    if (job.productContract.selectedTechnologyStack !== job.techStack) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productContract", "selectedTechnologyStack"],
        message: "Build job stack must match the canonical product contract",
      });
    }

    if (job.promptIntent) {
      if (job.promptIntent.originalPrompt !== job.description) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["promptIntent", "originalPrompt"],
          message: "Prompt intent original prompt must match the build job",
        });
      }

      if (
        job.promptIntent.primaryProductType &&
        job.promptIntent.primaryProductType !== job.productContract.productType
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["promptIntent", "primaryProductType"],
          message: "Prompt intent product type must match the canonical product contract",
        });
      }
    }
  });

export type BuildJob = z.infer<typeof buildJobSchema> & {
  productContract: ProductContract;
  promptIntent?: PromptIntent;
};

export function validateBuildJob(input: unknown): BuildJob {
  return buildJobSchema.parse(input) as BuildJob;
}

export function serializeBuildJob(input: BuildJob): string {
  return JSON.stringify(validateBuildJob(input));
}

export function deserializeBuildJob(raw: string): BuildJob {
  return validateBuildJob(JSON.parse(raw));
}

export function cloneBuildJob(input: BuildJob): BuildJob {
  return deserializeBuildJob(serializeBuildJob(input));
}
