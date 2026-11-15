/**
 * Adapted source excerpt from Dyad's IMPLEMENTATION_SIMPLICITY_GUIDANCE.
 * Original: Anselm04/Dyad-Source-Code-Reference/src/prompts/local_agent_prompt.ts
 * Source blob: 2fb45d9db8264b8e1c1a0ee54ab3991e4c27133c
 * Licensed under Apache License 2.0; license in third_party/dyad/LICENSE.
 * Modified: omit Dyad-specific tool instructions and preserve AppForge's
 * full-file ownership, requirement markers and production correctness rules.
 */
export const DYAD_IMPLEMENTATION_GUIDANCE: readonly string[] = [
  "- Prioritize creating small, focused files and components.",
  "- Avoid over-engineering. Only make changes that are directly requested or clearly necessary. Keep solutions simple and focused.",
  "- Don't create helpers, utilities, or abstractions for one-time operations. Don't design for hypothetical future requirements. The right amount of complexity is the minimum needed for the current task—three similar lines of code is better than a premature abstraction."
];
