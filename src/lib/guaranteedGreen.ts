/**
 * Last-resort deterministic app for golden stacks.
 * Uses recipe library so fallbacks stay on-prompt (not a generic hero only).
 */

import { hardenGeneratedProject } from "./reliableBuild.js";
import { buildRecipeApp, classifyRecipe } from "./appRecipes.js";

/**
 * Build a minimal, known-good Vite React app that typechecks and vite-builds.
 * Shape follows the classified recipe from the user prompt.
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
