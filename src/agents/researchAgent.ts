import { searchWeb } from "../services/webSearch.js";
import { appendAgentLog, markAgentLogComplete } from "../db.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  buildCuttingEdgeResearchQueries,
  verifyResearchEvidence,
} from "../lib/researchEvidence.js";

export type ResearchBrief = {
  query: string;
  context: string;
  searchedAt: string;
};

type ResearchFocus = "education" | "patent" | "architecture" | "general";

function focusQuery(
  focus: ResearchFocus,
  description: string,
  techStack: string,
  year: number,
): string | null {
  const subject = description.replace(/\s+/g, " ").trim().slice(0, 140);
  if (focus === "education")
    return `${subject} curriculum standards teaching resources ${techStack} ${year}`;
  if (focus === "patent")
    return `${subject} prior art patents existing products novelty official patent databases ${year}`;
  if (focus === "architecture")
    return `${subject} building code zoning accessibility fire safety official requirements ${year}`;
  return null;
}

/**
 * Core live-research loop for the Planner.
 *
 * Every planning cycle receives current multi-source evidence. Redesign cycles add
 * the sandbox failure dossier to the search so the next plan can learn from what
 * actually failed instead of repeating the same architecture.
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
  },
): Promise<string> {
  const focus = options?.focus ?? "general";
  const signal = options?.signal;
  const year = new Date().getUTCFullYear();
  const queries = buildCuttingEdgeResearchQueries({
    description,
    techStack,
    redesignBrief: options?.redesignBrief,
    year,
  });
  const specialized = focusQuery(focus, description, techStack, year);
  if (specialized) queries.push(specialized);

  emit("start", {
    message: options?.redesignBrief
      ? "Researching current verified alternatives for the sandbox failure…"
      : "Researching current verified implementation evidence before planning…",
    queries,
    redesign: !!options?.redesignBrief,
  });

  const logId = await appendAgentLog({
    projectId,
    agent: "Research",
    content: `# Live verified research\nQueries: ${queries.length}\n\n`,
    isComplete: false,
  });

  const responses = [];
  for (const query of queries) {
    if (signal?.aborted) break;
    const response = await searchWeb(query, 6, signal);
    responses.push(response);
    emit("source_batch", {
      query,
      sourceCount: response.results.length,
      searchedAt: response.searchedAt,
    });
  }

  const verified = verifyResearchEvidence(responses);
  const brief = verified.markdown;

  emit("complete", {
    message: `Verified ${verified.sourceCount} unique live sources across ${verified.hosts.length} independent hosts`,
    sourceCount: verified.sourceCount,
    independentHosts: verified.hosts.length,
    highConfidenceSources: verified.highConfidenceCount,
    redesign: !!options?.redesignBrief,
  });

  await db
    .update(schema.agentLogs)
    .set({ content: brief, updatedAt: new Date() })
    .where(eq(schema.agentLogs.id, logId));
  await markAgentLogComplete(logId);

  return brief;
}
