import { z } from "zod";
import { protectedProcedure } from "../_core/trpc.js";
import { invokeLLM } from "../_core/llm.js";
import { modelForAgent } from "../lib/llmModels.js";
import {
  EXTENSION_CAPABILITY_IDS,
  EXTENSION_STUDIOS,
  type ExtensionCapabilityId,
} from "../lib/extensionCapabilities.js";

function parseLlmJson(text: string): Record<string, unknown> {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
  } catch {
    return { raw: text };
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
  const plan = parseLlmJson(text);
  if (meta.disclaimer) {
    return { ...plan, disclaimer: meta.disclaimer };
  }
  return plan;
}

const briefInput = z.object({
  brief: z.string().min(5).max(8000),
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

export const EXTENSION_GENERATE_PROCEDURE: Record<
  ExtensionCapabilityId,
  keyof typeof extensionProcedures
> = {
  game: "generateGameProject",
  cad: "generateCadProduct",
  legal: "generateLegalDocuments",
  fintech: "generateFintechSchema",
  healthcare: "generateHealthcareConfig",
  mobile: "generateMobilePackaging",
  voice: "generateVoicePodcast",
  data: "generateBiDashboard",
  localization: "generateLocalizationBundle",
  collab: "generateCollabRoom",
};

/** Validates all extension IDs have procedures wired. */
export function assertExtensionProcedureCoverage(): boolean {
  return EXTENSION_CAPABILITY_IDS.every(
    (id) => EXTENSION_GENERATE_PROCEDURE[id] in extensionProcedures,
  );
}
