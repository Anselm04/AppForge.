import { searchWeb, formatSearchForPrompt } from "../services/webSearch.js";
import { appendAgentLog, markAgentLogComplete } from "../db.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

export type ResearchBrief = {
  query: string;
  context: string;
  searchedAt: string;
};

/** Run live web search and return markdown brief for Planner/Coder. */
export async function runResearchAgent(
  projectId: number,
  description: string,
  techStack: string,
  emit: (type: string, payload: unknown) => void,
  options?: { focus?: "education" | "patent" | "general" },
): Promise<string> {
  const focus = options?.focus ?? "general";
  const query =
    focus === "education"
      ? `${description.slice(0, 100)} curriculum standards lesson plans teaching resources 2026`.trim()
      : focus === "patent"
        ? `${description.slice(0, 100)} prior art patents existing products novelty`.trim()
        : `${description.slice(0, 120)} ${techStack} best practices 2026`.trim();

  emit("start", {
    message:
      focus === "education"
        ? "Researching current educational content and standards…"
        : focus === "patent"
          ? "Searching prior art and existing patents…"
          : "Searching the web for current information…",
    query,
  });

  const logId = await appendAgentLog({
    projectId,
    agent: "Research",
    content: `# Web research\nQuery: ${query}\n\n`,
    isComplete: false,
  });

  const response = await searchWeb(
    query,
    focus === "education" || focus === "patent" ? 8 : 6,
  );
  let brief = formatSearchForPrompt(response);

  if (focus === "education" && description.length > 20) {
    const supplemental = await searchWeb(
      `${description.slice(0, 80)} virtual classroom AR education technology`,
      4,
    );
    brief += `\n\n--- AR / EdTech sources ---\n${formatSearchForPrompt(supplemental)}`;
  }

  if (focus === "patent" && description.length > 20) {
    const supplemental = await searchWeb(
      `${description.slice(0, 80)} patent USPTO similar invention products`,
      5,
    );
    brief += `\n\n--- Prior art / patent databases ---\n${formatSearchForPrompt(supplemental)}`;
  }

  emit("complete", {
    message: `Found ${response.results.length} sources`,
    sourceCount: response.results.length,
    hasAnswer: !!response.answer,
  });

  await db
    .update(schema.agentLogs)
    .set({ content: brief, updatedAt: new Date() })
    .where(eq(schema.agentLogs.id, logId));
  await markAgentLogComplete(logId);

  return brief;
}
