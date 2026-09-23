import { searchWeb, type WebSearchResponse } from "../services/webSearch.js";
import { appendAgentLog, markAgentLogComplete } from "../db.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  buildCuttingEdgeResearchQueries,
  verifyResearchEvidence,
} from "../lib/researchEvidence.js";
import {
  validateProductContract,
  type ProductContract,
} from "../lib/productContract.js";

export type ResearchBrief = {
  query: string;
  context: string;
  searchedAt: string;
};

type ResearchFocus = "education" | "patent" | "architecture" | "general";

function focusQuery(focus: ResearchFocus, description: string, techStack: string, year: number): string | null {
  const subject = description.replace(/\s+/g, " ").trim().slice(0, 140);
  if (focus === "education") return `${subject} curriculum standards teaching resources ${techStack} ${year}`;
  if (focus === "patent") return `${subject} prior art patents existing products novelty official patent databases ${year}`;
  if (focus === "architecture") return `${subject} building code zoning accessibility fire safety official requirements ${year}`;
  return null;
}

/**
 * Research is a required planning input, but an unavailable search provider must
 * not make the build disappear. Each query is isolated so the planner receives
 * evidence plus an explicit record of any failed search.
 */
export async function runResearchAgent(
  projectId: number,
  description: string,
  techStack: string,
  emit: (type: string, payload: unknown) => void,
  options?: {
    focus?: ResearchFocus;
    signal?: AbortSignal;
    redesignBrief?: string;
    productContract?: ProductContract;
  },
): Promise<string> {
  const focus = options?.focus ?? "general";
  const signal = options?.signal;
  const contract = options?.productContract
    ? validateProductContract(options.productContract)
    : null;
  const canonicalDescription = contract?.originalPrompt ?? description;
  const year = new Date().getUTCFullYear();
  const queries = buildCuttingEdgeResearchQueries({
    description: canonicalDescription,
    techStack,
    redesignBrief: options?.redesignBrief,
    year,
  });
  if (contract) {
    for (const requirement of contract.researchRequirements) {
      if (!queries.includes(requirement)) queries.push(requirement);
    }
  }
  const specialized = focusQuery(focus, canonicalDescription, techStack, year);
  if (specialized) queries.push(specialized);

  emit("start", {
    message: options?.redesignBrief
      ? "Researching current verified alternatives for the sandbox failure…"
      : "Researching current verified implementation evidence before planning…",
    queries,
    live: true,
    providers: {
      tavily: Boolean(process.env.TAVILY_API_KEY),
      serpapi: Boolean(process.env.SERPAPI_API_KEY ?? process.env.SERP_API_KEY),
      duckduckgo: true,
    },
    redesign: !!options?.redesignBrief,
  });

  const logId = await appendAgentLog({
    projectId,
    agent: "Research",
    content: `# Live verified research\nQueries: ${queries.length}\n\n`,
    isComplete: false,
  });

  const responses: WebSearchResponse[] = [];
  const failures: string[] = [];
  for (const query of [...new Set(queries)]) {
    if (signal?.aborted) break;
    try {
      const response = await searchWeb(query, 6, signal);
      responses.push(response);
      emit("source_batch", {
        query,
        sourceCount: response.results.length,
        searchedAt: response.searchedAt,
        provider: response.results[0]?.source ?? "none",
        live: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search provider failed";
      failures.push(`${query}: ${message.slice(0, 180)}`);
      emit("source_error", { query, message: message.slice(0, 180), recoverable: true });
    }
  }

  const verified = verifyResearchEvidence(responses);
  const brief = [
    verified.markdown,
    "",
    "RESEARCH_EXECUTION:",
    `- Live queries attempted: ${queries.length}`,
    `- Queries completed: ${responses.length}`,
    `- Search failures: ${failures.length}`,
    ...failures.slice(0, 8).map((failure) => `- ${failure}`),
    "- Planner instruction: if evidence is weak, state the uncertainty and choose a reversible implementation; do not invent research results.",
  ].join("\n");

  emit("complete", {
    message: `Verified ${verified.sourceCount} unique live sources across ${verified.hosts.length} independent hosts`,
    sourceCount: verified.sourceCount,
    independentHosts: verified.hosts.length,
    highConfidenceSources: verified.highConfidenceCount,
    failedQueries: failures.length,
    live: true,
    redesign: !!options?.redesignBrief,
  });

  await db.update(schema.agentLogs).set({ content: brief, updatedAt: new Date() }).where(eq(schema.agentLogs.id, logId));
  await markAgentLogComplete(logId);
  return brief;
}
