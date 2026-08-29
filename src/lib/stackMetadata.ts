import { getValidationMode, type ValidationMode } from "./validationMode.js";

export type StackTier = "full" | "scaffold" | "experimental";

export type StackMeta = {
  id: string;
  label: string;
  tier: StackTier;
  validationMode: ValidationMode;
  dockerCapable: boolean;
  description: string;
};

const TIER_MAP: Record<string, StackTier> = {
  "react-node": "full",
  "next-node": "full",
  "vue-node": "full",
  "svelte-node": "full",
  "react-supabase": "full",
  "remix-node": "full",
  "astro-node": "full",
  "serverless-vercel": "full",
  "react-python": "scaffold",
  "react-django": "scaffold",
  "ai-agent-python": "scaffold",
  "ai-agent-node": "scaffold",
  "langchain-tool": "scaffold",
  "crewai-agent": "scaffold",
  "autogen-agent": "scaffold",
  "flutter-firebase": "scaffold",
  "flutter-game": "scaffold",
  "react-native-expo": "scaffold",
  "electron-react": "scaffold",
  "api-service": "scaffold",
  "phaser-html5": "scaffold",
  "three-js-3d": "scaffold",
  "babylon-js-3d": "scaffold",
  "unity-webgl": "experimental",
  "godot-html5": "experimental",
  "tauri-rust": "experimental",
  "chrome-extension": "experimental",
  "vscode-extension": "experimental",
  "serverless-aws": "experimental",
};

export function getStackMeta(stackId: string): StackMeta {
  const tier = TIER_MAP[stackId] ?? "scaffold";
  const validationMode = getValidationMode(stackId);
  const dockerCapable =
    stackId.includes("python") ||
    stackId.includes("flutter") ||
    stackId.includes("langchain") ||
    stackId.includes("crewai") ||
    stackId.includes("autogen");

  return {
    id: stackId,
    label: stackId.replace(/-/g, " "),
    tier,
    validationMode,
    dockerCapable,
    description:
      tier === "full"
        ? "Full sandbox: npm install, typecheck, tests, and production build."
        : tier === "scaffold"
          ? "Scaffold + syntax checks. Run full toolchain locally before production."
          : "Experimental scaffold. Structure and docs only — not production-validated.",
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
  if (tier === "scaffold") return "Scaffold only";
  return "Experimental";
}

export { GOLDEN_STACKS } from "./productionPreset.js";
