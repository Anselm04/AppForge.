/**
 * Debug-only deterministic app for golden stacks.
 * Customer success must NOT use this. Pipeline applies it only when
 * ALLOW_GUARANTEED_GREEN=true (operator debug). Default: off / never-give-up
 * keeps iterating with real LLMs instead.
 */

import { hardenGeneratedProject } from "./reliableBuild.js";
import { buildRecipeApp, classifyRecipe } from "./appRecipes.js";

/**
 * Build a minimal, known-good Vite React app that typechecks and vite-builds.
 * Shape follows the classified recipe from the user prompt.
 * Not customer success — debug / ALLOW_GUARANTEED_GREEN only.
 */
export function buildGuaranteedGreenApp(opts: {
  title: string;
  description: string;
  techStack: string;
}): Record<string, string> {
  const recipe = classifyRecipe(opts.description);
  const files = buildRecipeApp({
    title: opts.title,
    description: opts.description,
    techStack: opts.techStack,
    recipe,
  });
  return hardenGeneratedProject(files, opts.techStack || "react-node");
}
