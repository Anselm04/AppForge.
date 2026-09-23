import { getValidationMode, type ValidationMode } from "./validationMode.js";
import { getStackAdapter } from "./stackAdapters.js";

export type StackTier = "full" | "scaffold" | "experimental";

export type StackMeta = {
  id: string;
  label: string;
  tier: StackTier;
  validationMode: ValidationMode;
  dockerCapable: boolean;
  description: string;
  generationMode: "runnable" | "structural";
  previewMode: string;
  runtime: string;
  buildCommand: string | null;
  startCommand: string | null;
  outputDirectory: string | null;
  artifactKind: string;
  deploymentTargets: string[];
};

export function getStackMeta(stackId: string): StackMeta {
  const adapter = getStackAdapter(stackId);
  const validationMode = getValidationMode(adapter.id);
  const tier: StackTier =
    adapter.generationMode === "runnable" ? "full" : "scaffold";
  const dockerCapable =
    adapter.runtime === "node" || adapter.runtime === "python";

  return {
    id: adapter.id,
    label: adapter.label,
    tier,
    validationMode,
    dockerCapable,
    generationMode: adapter.generationMode,
    previewMode: adapter.previewMode,
    runtime: adapter.runtime,
    buildCommand: adapter.buildCommand,
    startCommand: adapter.startCommand,
    outputDirectory: adapter.outputDirectory,
    artifactKind: adapter.artifactKind,
    deploymentTargets: adapter.deploymentTargets,
    description:
      adapter.generationMode === "runnable"
        ? "Runnable stack adapter with stack-specific build, preview, runtime, deployment, and artifact metadata."
        : "Structural-only stack adapter. AppForge may generate the project structure, but it must not be represented as fully deployed or production-certified until its native toolchain is verified.",
  };
}

export function tierBadgeClass(tier: StackTier): string {
  if (tier === "full")
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (tier === "scaffold")
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
}

export function tierLabel(tier: StackTier): string {
  if (tier === "full") return "Full validation";
  if (tier === "scaffold") return "Structural only";
  return "Experimental";
}

export { GOLDEN_STACKS } from "./productionPreset.js";
