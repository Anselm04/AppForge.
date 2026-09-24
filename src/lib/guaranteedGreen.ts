/**
 * Debug-only deterministic app for golden stacks.
 * Customer success must NOT use this. Pipeline applies it only when
 * ALLOW_GUARANTEED_GREEN=true (operator debug). Default: off / never-give-up
 * keeps iterating with real LLMs instead.
 */

import {
  buildRecipeApp,
  classifyRecipe,
  recipeCoderHint,
} from "./appRecipes.js";
import {
  hardenGeneratedProject,
  hardeningProfileForStack,
} from "./reliableBuild.js";

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
  // Recipes are Vite React apps; never substitute one for another stack.
  if (hardeningProfileForStack(opts.techStack) !== "vite-react") {
    throw new Error(
      `Guaranteed-green recipes only exist for React + Vite stacks, not ${opts.techStack}`,
    );
  }
  const recipe = classifyRecipe(opts.description);
  const files = buildRecipeApp({
    title: opts.title,
    description: opts.description,
    techStack: opts.techStack,
    recipe,
  });
  return hardenGeneratedProject(files, opts.techStack);
}

/**
 * Recipes describe React UI screens. Only React-based web stacks (Vite React,
 * Next.js) get a recipe hint; games, services, mobile, Python and extensions
 * get none.
 */
export function stackRecipeCoderHint(
  description: string,
  techStack: string,
): string {
  const profile = hardeningProfileForStack(techStack);
  if (profile !== "vite-react" && profile !== "next") return "";
  return recipeCoderHint(description);
}
