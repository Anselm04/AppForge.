import type { BuildCapabilityId } from "./buildCapabilities.js";

/** Stacks with full npm/tsc/test/build sandbox validation. */
export const GOLDEN_STACKS = [
  "react-node",
  "next-node",
  "vue-node",
  "svelte-node",
  "react-supabase",
  "remix-node",
  "astro-node",
  "serverless-vercel",
] as const;

export type GoldenStack = (typeof GOLDEN_STACKS)[number];

export function isGoldenStack(stack: string): stack is GoldenStack {
  return (GOLDEN_STACKS as readonly string[]).includes(stack);
}

/** Default capabilities for production-ready builds. */
export const PRODUCTION_READY_CAPABILITIES: BuildCapabilityId[] = [
  "web_search",
  "graphics",
  "marketing",
];

export const PRODUCTION_READY_STACK: GoldenStack = "next-node";
