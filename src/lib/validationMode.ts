/** Matches buildValidator.ts — which stacks get full npm/tsc/vitest/vite validation. */
const STRUCTURAL_ONLY_PATTERNS = [
  "python",
  "langchain",
  "crewai",
  "autogen",
  "flutter",
  "unity",
  "godot",
  "chrome-extension",
  "vscode-extension",
  "serverless-aws",
] as const;

export type ValidationMode = "full" | "structural";

export function getValidationMode(techStack: string): ValidationMode {
  const stack = techStack.toLowerCase();
  if (STRUCTURAL_ONLY_PATTERNS.some((p) => stack.includes(p))) {
    return "structural";
  }
  return "full";
}

export function validationModeLabel(mode: ValidationMode): string {
  return mode === "full"
    ? "Full compile (npm install, tsc, tests, build)"
    : "Structure check only (no sandbox compile)";
}
