import { PROMPT_MAX_CHARS } from "./prompt.js";

export function buildOpportunityBuildPath(buildBrief: string): string {
  return `/app/new?idea=${encodeURIComponent(buildBrief.slice(0, PROMPT_MAX_CHARS))}`;
}

export function promptFromOpportunityQuery(
  search: string,
  savedDraft: string,
): string {
  const idea = new URLSearchParams(search).get("idea")?.trim() ?? "";
  return idea ? idea.slice(0, PROMPT_MAX_CHARS) : savedDraft;
}
