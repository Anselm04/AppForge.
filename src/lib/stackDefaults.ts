import { normalizeStackId } from "./stackAdapters.js";

/**
 * Normalize explicit stack aliases without silently converting unknown stacks
 * into React. "auto"/blank keeps the historical web default only when no
 * explicit stack was selected.
 */
export function preferReactNodeStack(
  techStack: string | undefined | null,
): string {
  const raw = (techStack ?? "").trim();
  if (!raw || raw.toLowerCase() === "default" || raw.toLowerCase() === "auto") {
    return "react-node";
  }
  return normalizeStackId(raw);
}
