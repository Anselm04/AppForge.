import { normalizeStackId } from "./stackAdapters.js";

/**
 * Normalize an explicit stack id/alias. A blank, "auto" or "default" stack is
 * rejected: edits, self-heal and hardening must run on the project's recorded
 * (contract) stack and never silently fall back to React.
 */
export function requireExplicitStack(
  techStack: string | undefined | null,
): string {
  const raw = (techStack ?? "").trim();
  if (!raw || raw.toLowerCase() === "default" || raw.toLowerCase() === "auto") {
    throw new Error(
      "A technology stack is required; AppForge does not fall back to a default stack",
    );
  }
  return normalizeStackId(raw);
}
