/** Per-agent model routing (OpenAI-compatible model names). */

export type AgentRole =
  "planner" | "coder" | "reviewer" | "moderation" | "senior_dev";

const FALLBACK_MODEL =
  (process.env.LLM_MODEL_DEFAULT ?? "").trim() || "gpt-4o-mini";

const DEFAULTS: Record<AgentRole, string> = {
  planner: process.env.LLM_MODEL_PLANNER ?? FALLBACK_MODEL,
  coder: process.env.LLM_MODEL_CODER ?? FALLBACK_MODEL,
  reviewer: process.env.LLM_MODEL_REVIEWER ?? FALLBACK_MODEL,
  moderation: process.env.LLM_MODEL_MODERATION ?? FALLBACK_MODEL,
  senior_dev: process.env.LLM_MODEL_SENIOR_DEV ?? FALLBACK_MODEL,
};

export function modelForAgent(role: AgentRole): string | undefined {
  const m = DEFAULTS[role]?.trim();
  return m || undefined;
}
