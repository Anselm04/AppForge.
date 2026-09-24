/**
 * Optional LLM enrichment of the deterministic, prompt-specific product
 * contract. The model can only ADD schema-valid items; it can never change the
 * original prompt, product type, selected stack, capabilities, or the ids and
 * text of existing requirements. Any failure (no provider, timeout, invalid
 * JSON, schema violation) returns the deterministic contract unchanged, so the
 * contract is always derived from the prompt either way.
 */
import { z } from "zod";
import {
  validateProductContract,
  type ProductContract,
} from "./productContract.js";

const MAX_REQUIREMENTS = 24;
const MAX_LIST_ITEMS = 12;

const text = z.string().trim().min(3).max(240);

export const contractEnrichmentSchema = z
  .object({
    additionalRequirements: z
      .array(
        z.object({
          text,
          category: z.enum([
            "workflow",
            "quality",
            "security",
            "monetization",
            "operations",
          ]),
          priority: z.enum(["must", "should", "could"]),
        }),
      )
      .max(8)
      .default([]),
    targetUsers: z.array(text).max(6).default([]),
    userRoles: z.array(z.string().trim().min(2).max(60)).max(6).default([]),
    coreWorkflows: z.array(text).max(6).default([]),
    dataModels: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[A-Z][A-Za-z0-9]{1,48}$/),
      )
      .max(8)
      .default([]),
    integrations: z.array(z.string().trim().min(2).max(60)).max(6).default([]),
    securityRequirements: z.array(text).max(6).default([]),
  })
  .strict();

export type ContractEnrichment = z.infer<typeof contractEnrichmentSchema>;

/** Minimal model call contract so tests and callers can inject a provider. */
export type EnrichmentModelCall = (input: {
  system: string;
  user: string;
  signal: AbortSignal;
}) => Promise<string>;

export type EnrichmentResult = {
  contract: ProductContract;
  source: "prompt_deterministic" | "prompt_deterministic_llm_enriched";
  fallbackReason?: string;
};

function mergeList(
  base: string[],
  extra: string[],
  limit = MAX_LIST_ITEMS,
): string[] {
  const seen = new Set(base.map((item) => item.toLowerCase()));
  const merged = [...base];
  for (const item of extra) {
    const key = item.toLowerCase();
    if (seen.has(key) || merged.length >= limit) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

export function mergeContractEnrichment(
  contract: ProductContract,
  enrichment: ContractEnrichment,
): ProductContract {
  const existingText = new Set(
    contract.functionalRequirements.map((requirement) =>
      requirement.text.toLowerCase(),
    ),
  );
  const requirements = [...contract.functionalRequirements];
  let next =
    requirements.reduce(
      (max, requirement) =>
        Math.max(max, Number(requirement.id.slice("REQ-".length))),
      0,
    ) + 1;
  for (const addition of enrichment.additionalRequirements) {
    if (requirements.length >= MAX_REQUIREMENTS) break;
    if (existingText.has(addition.text.toLowerCase())) continue;
    existingText.add(addition.text.toLowerCase());
    requirements.push({
      id: `REQ-${String(next).padStart(3, "0")}`,
      ...addition,
    });
    next += 1;
  }

  const merged = validateProductContract({
    ...contract,
    targetUsers: mergeList(contract.targetUsers, enrichment.targetUsers),
    userRoles: mergeList(contract.userRoles, enrichment.userRoles),
    coreWorkflows: mergeList(contract.coreWorkflows, enrichment.coreWorkflows),
    functionalRequirements: requirements,
    dataModels: mergeList(contract.dataModels, enrichment.dataModels, 16),
    integrations: mergeList(contract.integrations, enrichment.integrations),
    securityRequirements: mergeList(
      contract.securityRequirements,
      enrichment.securityRequirements,
      16,
    ),
    contractDerivation: "prompt_deterministic_llm_enriched",
  });

  // Invariants: enrichment never rewrites what the deterministic contract fixed.
  if (
    merged.originalPrompt !== contract.originalPrompt ||
    merged.productType !== contract.productType ||
    merged.selectedTechnologyStack !== contract.selectedTechnologyStack ||
    contract.functionalRequirements.some(
      (requirement, index) =>
        merged.functionalRequirements[index]?.id !== requirement.id ||
        merged.functionalRequirements[index]?.text !== requirement.text,
    )
  ) {
    throw new Error("Contract enrichment attempted to change fixed fields");
  }
  return merged;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(body.slice(start, end + 1));
}

function buildMessages(contract: ProductContract): {
  system: string;
  user: string;
} {
  return {
    system:
      "You refine software product contracts. Reply with ONE JSON object only. " +
      "Allowed keys: additionalRequirements (array of {text, category: workflow|quality|security|monetization|operations, priority: must|should|could}), " +
      "targetUsers, userRoles, coreWorkflows, dataModels (PascalCase names), integrations, securityRequirements (arrays of short strings). " +
      "Only add items clearly implied by the user's prompt that the contract is missing. Never invent payments, integrations, or features the prompt does not imply. " +
      "Do not repeat existing items. Do not change the product type or stack.",
    user: JSON.stringify({
      originalPrompt: contract.originalPrompt,
      productType: contract.productType,
      selectedTechnologyStack: contract.selectedTechnologyStack,
      existing: {
        targetUsers: contract.targetUsers,
        userRoles: contract.userRoles,
        coreWorkflows: contract.coreWorkflows,
        functionalRequirements: contract.functionalRequirements.map(
          (requirement) => requirement.text,
        ),
        dataModels: contract.dataModels,
        integrations: contract.integrations,
        securityRequirements: contract.securityRequirements,
      },
    }),
  };
}

async function defaultModelCall(): Promise<EnrichmentModelCall | null> {
  const { configuredLlmProviderIds, invokeLLM } =
    await import("../_core/llm.js");
  if (configuredLlmProviderIds().length === 0) return null;
  return async ({ system, user, signal }) => {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 1200,
      signal,
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    return (content ?? [])
      .map((part) => ("text" in part ? part.text : ""))
      .join("");
  };
}

/**
 * Enrich a deterministic contract with a model if one is configured. Always
 * resolves; never throws. `modelCall: null` forces the deterministic path.
 */
export async function enrichProductContract(
  contract: ProductContract,
  options: { modelCall?: EnrichmentModelCall | null; timeoutMs?: number } = {},
): Promise<EnrichmentResult> {
  const deterministic: EnrichmentResult = {
    contract,
    source: "prompt_deterministic",
  };
  if (process.env.APPFORGE_CONTRACT_LLM_ENRICHMENT === "off") {
    return { ...deterministic, fallbackReason: "disabled" };
  }
  let modelCall: EnrichmentModelCall | null;
  try {
    modelCall =
      options.modelCall === undefined
        ? await defaultModelCall()
        : options.modelCall;
  } catch (error) {
    return {
      ...deterministic,
      fallbackReason: `provider_unavailable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!modelCall) {
    return { ...deterministic, fallbackReason: "no_llm_provider" };
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 8_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { system, user } = buildMessages(contract);
    const raw = await Promise.race([
      modelCall({ system, user, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error(`timed out after ${timeoutMs}ms`)),
        );
      }),
    ]);
    const enrichment = contractEnrichmentSchema.parse(extractJsonObject(raw));
    return {
      contract: mergeContractEnrichment(contract, enrichment),
      source: "prompt_deterministic_llm_enriched",
    };
  } catch (error) {
    return {
      ...deterministic,
      fallbackReason:
        `llm_enrichment_failed: ${error instanceof Error ? error.message : String(error)}`.slice(
          0,
          300,
        ),
    };
  } finally {
    clearTimeout(timer);
  }
}
