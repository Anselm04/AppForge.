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

/** Keep deployment choices aligned with the selected adapter, never its runtime hints. */
export function filterDeployOptionsForStack<T extends Record<string, unknown>>(
  techStack: string | null | undefined,
  options: T,
): Partial<T> {
  let destinations = new Set(["zip"]);
  try {
    const adapter = getStackAdapter(techStack ?? "");
    if (adapter.generationMode !== "structural") {
      destinations = new Set(["zip", ...adapter.deploymentTargets]);
    }
  } catch {
    // Unknown legacy stacks have no verified deployment adapter.
  }
  return Object.fromEntries(
    Object.entries(options).filter(([destination]) =>
      destinations.has(destination),
    ),
  ) as Partial<T>;
}

/** Correct stale readiness at the API boundary without rewriting stored history. */
export function projectReadinessForApi<
  T extends {
    techStack: string | null;
    status: string | null;
    outputMaturity?: string | null;
  },
>(project: T) {
  let generationMode: "structural" | "unknown" = "structural";
  try {
    if (
      getStackAdapter(project.techStack ?? "").generationMode !== "structural"
    ) {
      return project;
    }
  } catch {
    generationMode = "unknown";
  }
  return {
    ...project,
    status:
      project.status === "production-certified"
        ? ("validated" as const)
        : project.status,
    outputMaturity: "structural" as const,
    generationMode,
    sourceDeliverable: true as const,
  };
}

/**
 * The URL the Build page may show after a completed build: a verified HTTPS
 * verified live URL only. AppForge workspace/preview routes are never treated
 * as the generated customer's deployed product.
 */
export function completedBuildUrl(opts: {
  liveUrl: string | null;
  projectId: number | null;
  structuralOnly: boolean;
}): string | null {
  if (opts.structuralOnly) return null;
  if (opts.liveUrl) return opts.liveUrl;
  // A local AppForge route is a preview/workspace surface, not proof that the
  // generated customer product is deployed. Never present the AppForge shell
  // as the user's live product.
  return null;
}
