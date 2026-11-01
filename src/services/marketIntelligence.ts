import { z } from "zod";
import { invokeLLM } from "../_core/llm.js";
import { modelForAgent } from "../lib/llmModels.js";
import {
  calculateOpportunityScore,
  createMarketingHandoff,
  publishingReadinessForIdea,
  recommendOpportunity,
  sanitizeAnalysisEvidence,
  type MarketIntelligenceAnalysis,
  type MarketIntelligenceReport,
  type MarketIntelligenceSource,
} from "../lib/marketIntelligence.js";
import { searchWeb, type WebSearchResult } from "./webSearch.js";

const evidenceItemSchema = z.object({
  text: z.string().trim().min(1).max(1_500),
  evidence: z.array(z.number().int().positive()).max(12),
});

const analysisSchema = z.object({
  summary: evidenceItemSchema,
  positioning: evidenceItemSchema,
  customerPains: z.array(evidenceItemSchema).max(10),
  featureGaps: z.array(evidenceItemSchema).max(10),
  marketingHooks: z.array(evidenceItemSchema).max(10),
  monetization: z
    .array(
      evidenceItemSchema.extend({
        model: z.string().trim().min(1).max(120),
        rationale: z.string().trim().min(1).max(1_000),
      }),
    )
    .max(8),
  risks: z.array(evidenceItemSchema).max(10),
  scores: z.object({
    demand: z.number(),
    monetization: z.number(),
    differentiation: z.number(),
    marketingReach: z.number(),
    competition: z.number(),
  }),
  confidence: z.enum(["high", "medium", "low"]),
  buildBrief: z.string().trim().min(20).max(8_000),
  audience: z.string().trim().min(1).max(500),
});

export type MarketResearchInput = {
  idea: string;
  audience?: string;
  region?: string;
  maxSources?: number;
};

export function buildMarketResearchQueries(
  input: MarketResearchInput,
): string[] {
  const context = [input.idea, input.audience, input.region]
    .filter(Boolean)
    .join(" ");
  return [
    `${context} market demand alternatives pricing`,
    `${context} competitor apps features pricing`,
    `${context} customer reviews complaints requested features`,
    `${context} marketing positioning acquisition channels advertising`,
  ];
}

export function dedupeMarketSources(
  results: WebSearchResult[],
): MarketIntelligenceSource[] {
  const seen = new Set<string>();
  const output: MarketIntelligenceSource[] = [];
  for (const result of results) {
    const normalized = result.url.trim().replace(/\/$/, "");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push({ ...result, id: output.length + 1 });
  }
  return output;
}

export function parseMarketAnalysis(text: string): MarketIntelligenceAnalysis {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json)
    throw new Error("Model did not return valid market intelligence JSON");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Model did not return valid market intelligence JSON");
  }
  const parsed = analysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Model did not return valid market intelligence analysis");
  }
  return parsed.data;
}

function evidencePrompt(sources: MarketIntelligenceSource[]): string {
  return sources
    .map(
      (source) =>
        `[${source.id}] ${source.title}\nURL: ${source.url}\nEvidence: ${source.snippet}`,
    )
    .join("\n\n");
}

export async function researchMarketOpportunity(
  input: MarketResearchInput,
): Promise<MarketIntelligenceReport> {
  const maxSources = Math.min(18, Math.max(6, input.maxSources ?? 12));
  const searches = await Promise.all(
    buildMarketResearchQueries(input).map((query) =>
      searchWeb(query, Math.ceil(maxSources / 4)),
    ),
  );
  const sources = dedupeMarketSources(
    searches.flatMap((search) => search.results),
  ).slice(0, maxSources);
  if (sources.length === 0) {
    throw new Error("Research sources are currently unavailable");
  }

  const result = await invokeLLM({
    model: modelForAgent("planner"),
    messages: [
      {
        role: "system",
        content:
          "You are AppForge Market Intelligence. Use only the supplied evidence. Never invent downloads, revenue, ad spend, rankings, conversion rates, or competitor facts. Every factual claim must cite source IDs from the evidence array. Return JSON only with keys summary, positioning, customerPains, featureGaps, marketingHooks, monetization, risks, scores, confidence, buildBrief, audience. summary/positioning/customerPains/featureGaps/marketingHooks/risks use {text,evidence}. monetization uses {model,rationale,text,evidence}. scores contains demand, monetization, differentiation, marketingReach, competition as 0-100 judgment scores based on evidence, not private metrics. confidence is high|medium|low. buildBrief must be a concrete product brief AppForge can build.",
      },
      {
        role: "user",
        content: `Idea: ${input.idea}\nAudience: ${input.audience ?? "infer only if evidence supports it"}\nRegion: ${input.region ?? "global unless evidence is region-specific"}\n\nEvidence:\n${evidencePrompt(sources)}`,
      },
    ],
  });

  const content = result.choices[0]?.message?.content;
  const analysis = parseMarketAnalysis(
    typeof content === "string" ? content : "",
  );
  const sanitized = sanitizeAnalysisEvidence(
    analysis,
    new Set(sources.map((source) => source.id)),
  );
  const score = calculateOpportunityScore(sanitized.scores);

  return {
    ...sanitized,
    score,
    recommendation: recommendOpportunity(score),
    publishingReadiness: publishingReadinessForIdea(sanitized.buildBrief),
    marketingHandoff: createMarketingHandoff(sanitized),
    sources,
    researchedAt: new Date().toISOString(),
  };
}
