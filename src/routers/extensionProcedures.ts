import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../_core/trpc.js";
import { invokeLLM } from "../_core/llm.js";
import { modelForAgent } from "../lib/llmModels.js";
import {
  EXTENSION_CAPABILITY_IDS,
  EXTENSION_STUDIOS,
  EXTENSION_GENERATE_PROCEDURE,
  type ExtensionCapabilityId,
} from "../lib/extensionCapabilities.js";

const MAX_EXTENSION_PLAN_BYTES = 250_000;

const nonEmptyPlanSchema = z
  .record(z.unknown())
  .refine((plan) => Object.keys(plan).length > 0, {
    message: "Extension plan must not be empty",
  });

const gamePlanSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    engine: z.enum(["phaser", "godot-web", "canvas"]),
    genre: z.string().trim().min(1).max(120),
    mechanics: z.array(z.string().trim().min(1).max(240)).min(1).max(30),
    scenes: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          name: z.string().trim().min(1).max(120),
          entities: z.unknown(),
        }),
      )
      .min(1)
      .max(50),
    assets: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          type: z.string().trim().min(1).max(80),
          description: z.string().trim().min(1).max(1_000),
        }),
      )
      .max(200),
    webglPreview: z.object({
      playerControls: z.string().trim().min(1).max(2_000),
      winCondition: z.string().trim().min(1).max(2_000),
    }),
    buildSteps: z.array(z.string().trim().min(1).max(1_000)).min(1).max(40),
  })
  .passthrough();

const mobilePlanSchema = z
  .object({
    framework: z.enum(["expo", "capacitor"]),
    appName: z.string().trim().min(1).max(120),
    bundleId: z
      .string()
      .trim()
      .min(3)
      .max(255)
      .regex(
        /^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)+$/,
        "bundleId must be a reverse-DNS identifier",
      ),
    platforms: z.array(z.enum(["ios", "android"])).min(1).max(2),
    storeListing: z.object({
      title: z.string().trim().min(1).max(120),
      subtitle: z.string().trim().max(120),
      description: z.string().trim().min(1).max(8_000),
      keywords: z.array(z.string().trim().min(1).max(80)).max(50),
    }),
    icons: z
      .array(
        z.object({
          size: z.union([z.string().trim().min(1).max(40), z.number().positive()]),
          purpose: z.string().trim().min(1).max(120),
        }),
      )
      .min(1)
      .max(50),
    permissions: z.array(z.string().trim().min(1).max(200)).max(50),
    buildCommands: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  })
  .passthrough();

const collabPlanSchema = z
  .object({
    roomId: z.string().trim().min(1).max(160),
    transport: z.enum(["websocket", "webrtc"]),
    roles: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          permissions: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
        }),
      )
      .min(1)
      .max(20),
    syncedArtifacts: z.array(z.string().trim().min(1).max(240)).min(1).max(100),
    presenceEvents: z.array(z.string().trim().min(1).max(160)).max(100),
    conflictStrategy: z.string().trim().min(1).max(2_000),
    cursors: z.boolean(),
    versionHistory: z.boolean(),
  })
  .passthrough();

const EXTENSION_PLAN_SCHEMAS: Partial<Record<ExtensionCapabilityId, z.ZodTypeAny>> = {
  game: gamePlanSchema,
  mobile: mobilePlanSchema,
  collab: collabPlanSchema,
};

export function parseExtensionPlanJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI returned an empty extension plan.",
    });
  }
  if (Buffer.byteLength(trimmed, "utf8") > MAX_EXTENSION_PLAN_BYTES) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI returned an extension plan that is too large.",
    });
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI returned an invalid structured extension plan.",
    });
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Extension plan must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI returned an invalid structured extension plan.",
      cause: error,
    });
  }
}

export function validateExtensionPlan(
  id: ExtensionCapabilityId,
  plan: Record<string, unknown>,
): Record<string, unknown> {
  const schema = EXTENSION_PLAN_SCHEMAS[id] ?? nonEmptyPlanSchema;
  const result = schema.safeParse(plan);
  if (!result.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `AI returned an invalid ${id} extension plan.`,
      cause: result.error,
    });
  }
  return result.data as Record<string, unknown>;
}

async function generateExtensionPlan(
  id: ExtensionCapabilityId,
  brief: string,
): Promise<Record<string, unknown>> {
  const meta = EXTENSION_STUDIOS[id];
  const result = await invokeLLM({
    model: modelForAgent("planner"),
    messages: [
      { role: "system", content: meta.generateSystemPrompt },
      { role: "user", content: brief },
    ],
  });
  const text =
    typeof result.choices[0]?.message?.content === "string"
      ? result.choices[0].message.content
      : "";
  const plan = validateExtensionPlan(id, parseExtensionPlanJson(text));
  if (meta.disclaimer) {
    return { ...plan, disclaimer: meta.disclaimer };
  }
  return plan;
}

const briefInput = z.object({
  brief: z.string().trim().min(5).max(8000),
});

function makeGenerate(id: ExtensionCapabilityId) {
  return protectedProcedure.input(briefInput).mutation(async ({ input }) => {
    return generateExtensionPlan(id, input.brief);
  });
}

/** Extension studio tRPC procedures — merged into capabilitiesRouter. */
export const extensionProcedures = {
  generateGameProject: makeGenerate("game"),
  generateCadProduct: makeGenerate("cad"),
  generateLegalDocuments: makeGenerate("legal"),
  generateFintechSchema: makeGenerate("fintech"),
  generateHealthcareConfig: makeGenerate("healthcare"),
  generateMobilePackaging: makeGenerate("mobile"),
  generateVoicePodcast: makeGenerate("voice"),
  generateBiDashboard: makeGenerate("data"),
  generateLocalizationBundle: makeGenerate("localization"),
  generateCollabRoom: makeGenerate("collab"),
};

export { EXTENSION_GENERATE_PROCEDURE } from "../lib/extensionCapabilities.js";

/** Validates all extension IDs have procedures wired. */
export function assertExtensionProcedureCoverage(): boolean {
  return EXTENSION_CAPABILITY_IDS.every(
    (id) => EXTENSION_GENERATE_PROCEDURE[id] in extensionProcedures,
  );
}
