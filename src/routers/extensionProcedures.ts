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

export function parseExtensionPlanJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI returned an empty extension plan.",
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
  const plan = parseExtensionPlanJson(text);
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
