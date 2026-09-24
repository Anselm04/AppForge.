import { getStackAdapter } from "./stackAdapters.js";

export type UiDeployDestination =
  "vercel" | "netlify" | "fly" | "preview" | "github-pages";

const UI_DESTINATIONS: UiDeployDestination[] = [
  "preview",
  "vercel",
  "netlify",
  "fly",
  "github-pages",
];

export type StackPresentation = {
  id: string;
  label: string;
  structuralOnly: boolean;
  badge: string;
  notice: string | null;
  deployDestinations: UiDeployDestination[];
};

/**
 * How the UI describes a project's stack. Structural-only stacks are always
 * labelled as source-only and get no deploy destinations or live URL.
 */
export function stackPresentation(
  techStack: string | null | undefined,
): StackPresentation | null {
  if (!techStack) return null;
  let adapter;
  try {
    adapter = getStackAdapter(techStack);
  } catch {
    return null;
  }
  const structuralOnly = adapter.generationMode === "structural";
  return {
    id: adapter.id,
    label: adapter.label,
    structuralOnly,
    badge: structuralOnly ? "Structural only · not deployed" : "Runnable",
    notice: structuralOnly
      ? `${adapter.label} is a structural-only stack. AppForge generated the ${adapter.runtime} source but has not verified it on the native toolchain and does not deploy it. Download the ZIP or export to GitHub, then build it locally (${adapter.buildCommand ?? "see README"}).`
      : null,
    deployDestinations: structuralOnly
      ? []
      : UI_DESTINATIONS.filter((destination) =>
          adapter.deploymentTargets.includes(destination),
        ),
  };
}

/**
 * The URL the Build page may show after a completed build: a verified HTTPS
 * live URL, else the hosted preview for runnable stacks, never anything for
 * structural-only builds.
 */
export function completedBuildUrl(opts: {
  liveUrl: string | null;
  projectId: number | null;
  structuralOnly: boolean;
}): string | null {
  if (opts.structuralOnly) return null;
  if (opts.liveUrl) return opts.liveUrl;
  return opts.projectId ? `/apps/${opts.projectId}` : null;
}
