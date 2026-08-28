/** Per-agent model routing (OpenAI-compatible model names). */

export type AgentRole =
  "planner" | "coder" | "reviewer" | "moderation" | "senior_dev";

const DEFAULTS: Record<AgentRole, string> = {
  planner: process.env.LLM_MODEL_PLANNER ?? process.env.LLM_MODEL_DEFAULT ?? "",
  coder: process.env.LLM_MODEL_CODER ?? process.env.LLM_MODEL_DEFAULT ?? "",
  reviewer:
    process.env.LLM_MODEL_REVIEWER ?? process.env.LLM_MODEL_DEFAULT ?? "",
  moderation:
    process.env.LLM_MODEL_MODERATION ?? process.env.LLM_MODEL_DEFAULT ?? "",
  senior_dev:
    process.env.LLM_MODEL_SENIOR_DEV ?? process.env.LLM_MODEL_DEFAULT ?? "",
};

export function modelForAgent(role: AgentRole): string | undefined {
  const m = DEFAULTS[role]?.trim();
  return m || undefined;
}
