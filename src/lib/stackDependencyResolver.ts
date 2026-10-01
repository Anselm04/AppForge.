/**
 * Resolves the Product -> Stack -> External Technology Adapters -> Runner ->
 * Evidence dependency graph for a build before it is allowed to start.
 * This is the single place that decides whether a stack's external
 * dependencies justify building at all, and whether they justify a
 * production-certified claim. It never provisions anything itself — it only
 * reads the adapter registry's declared state and reports the truth.
 */

import {
  isAtLeast,
  type AdapterCapabilityState,
  type TechnologyAdapterDescriptor,
} from "./adapterSdk.js";
import { getExternalTechnologyAdapter } from "./externalTechnologyAdapters.js";
import {
  externalDependenciesForStack,
  type StackExternalDependency,
} from "./stackDependencies.js";
import { getStackAdapter } from "./stackAdapters.js";

export type DependencyResolutionStatus =
  | "resolved"
  | "resolved_deprecated"
  | "missing_adapter"
  | "version_incompatible"
  | "insufficient_capability"
  | "quarantined"
  | "retired_blocked";

const BLOCKING_STATUSES = new Set<DependencyResolutionStatus>([
  "missing_adapter",
  "version_incompatible",
  "insufficient_capability",
  "quarantined",
  "retired_blocked",
]);

export type ResolvedDependencyNode = {
  adapterId: string;
  purpose: string;
  requiredVersionConstraint: string;
  minimumCapabilityLevel: AdapterCapabilityState;
  status: DependencyResolutionStatus;
  resolvedVersion: string | null;
  resolvedState: AdapterCapabilityState | null;
  /** Honest "is there a working build path today" signal, not a live probe. */
  runnerAvailable: boolean;
  message: string;
};

export type StackDependencyGraph = {
  productType: string;
  stackId: string;
  dependencies: ResolvedDependencyNode[];
  /** False when any dependency is missing, incompatible, quarantined or retired. */
  allowed: boolean;
  /** False when any resolved dependency is deprecated or below "verified". */
  productionEligible: boolean;
  /** Lowest capability state reached by any dependency (or production-certified when there are none). */
  capabilityCeiling: AdapterCapabilityState;
};

export type DependencyEvidenceEntry = {
  adapterId: string;
  purpose: string;
  resolvedVersion: string | null;
  resolvedState: AdapterCapabilityState | null;
  status: DependencyResolutionStatus;
};

function versionSatisfied(
  adapter: TechnologyAdapterDescriptor,
  constraint: string,
): boolean {
  if (constraint === "any") return true;
  return adapter.supportedVersions.includes(constraint);
}

function resolveDependency(
  dependency: StackExternalDependency,
  lookupAdapter: (id: string) => TechnologyAdapterDescriptor | undefined,
): ResolvedDependencyNode {
  const adapter = lookupAdapter(dependency.adapterId);
  const base = {
    adapterId: dependency.adapterId,
    purpose: dependency.purpose,
    requiredVersionConstraint: dependency.versionConstraint,
    minimumCapabilityLevel: dependency.minimumCapabilityLevel,
  };

  if (!adapter) {
    return {
      ...base,
      status: "missing_adapter",
      resolvedVersion: null,
      resolvedState: null,
      runnerAvailable: false,
      message: `No registered adapter for "${dependency.adapterId}".`,
    };
  }

  if (adapter.lifecycleStatus === "retired") {
    return {
      ...base,
      status: "retired_blocked",
      resolvedVersion: adapter.latestCompatibleStableVersion,
      resolvedState: adapter.state,
      runnerAvailable: false,
      message: `${adapter.label} is retired. Use replacementPath before routing builds to it.`,
    };
  }

  if (adapter.quarantine?.quarantined) {
    return {
      ...base,
      status: "quarantined",
      resolvedVersion: adapter.latestCompatibleStableVersion,
      resolvedState: adapter.state,
      runnerAvailable: false,
      message: `${adapter.label} is quarantined: ${adapter.quarantine.reason ?? "unspecified regression"}.`,
    };
  }

  if (!versionSatisfied(adapter, dependency.versionConstraint)) {
    return {
      ...base,
      status: "version_incompatible",
      resolvedVersion: adapter.latestCompatibleStableVersion,
      resolvedState: adapter.state,
      runnerAvailable: false,
      message: `${adapter.label} does not support required version "${dependency.versionConstraint}" (supports: ${adapter.supportedVersions.join(", ")}).`,
    };
  }

  if (!isAtLeast(adapter.state, dependency.minimumCapabilityLevel)) {
    return {
      ...base,
      status: "insufficient_capability",
      resolvedVersion: adapter.latestCompatibleStableVersion,
      resolvedState: adapter.state,
      runnerAvailable: isAtLeast(adapter.state, "buildable"),
      message: `${adapter.label} is at "${adapter.state}" but this stack requires at least "${dependency.minimumCapabilityLevel}".`,
    };
  }

  const runnerAvailable = isAtLeast(adapter.state, "buildable");

  if (adapter.lifecycleStatus === "deprecated") {
    return {
      ...base,
      status: "resolved_deprecated",
      resolvedVersion: adapter.latestCompatibleStableVersion,
      resolvedState: adapter.state,
      runnerAvailable,
      message:
        adapter.deprecationNotice ??
        `${adapter.label} is deprecated. Builds may proceed, but production certification is withheld.`,
    };
  }

  return {
    ...base,
    status: "resolved",
    resolvedVersion: adapter.latestCompatibleStableVersion,
    resolvedState: adapter.state,
    runnerAvailable,
    message:
      `${adapter.label} ${adapter.latestCompatibleStableVersion ?? ""} satisfies "${dependency.minimumCapabilityLevel}".`.trim(),
  };
}

/**
 * Resolves the full dependency graph for one stack. Validates the stack id
 * through the existing stackAdapters.ts registry (no duplicated stack
 * logic) and attaches external-adapter resolution on top of it.
 */
export function resolveStackDependencyGraph(
  stackId: string,
  productType?: string,
  options?: {
    /** Override the declared dependency list, e.g. for test isolation. */
    dependencies?: StackExternalDependency[];
    /** Override adapter lookup, e.g. to test missing/quarantined/retired adapters without mutating the live registry. */
    lookupAdapter?: (id: string) => TechnologyAdapterDescriptor | undefined;
  },
): StackDependencyGraph {
  const adapter = getStackAdapter(stackId);
  const lookupAdapter = options?.lookupAdapter ?? getExternalTechnologyAdapter;
  const declaredDependencies =
    options?.dependencies ?? externalDependenciesForStack(adapter.id);
  const dependencies = declaredDependencies.map((dependency) =>
    resolveDependency(dependency, lookupAdapter),
  );

  const allowed = dependencies.every(
    (node) => !BLOCKING_STATUSES.has(node.status),
  );
  const productionEligible =
    allowed &&
    dependencies.every(
      (node) =>
        node.status === "resolved" &&
        node.resolvedState !== null &&
        isAtLeast(node.resolvedState, "verified"),
    );

  const capabilityCeiling: AdapterCapabilityState = dependencies.reduce(
    (ceiling, node) => {
      if (!node.resolvedState) return "unsupported";
      return isAtLeast(ceiling, node.resolvedState)
        ? node.resolvedState
        : ceiling;
    },
    "production-certified" as AdapterCapabilityState,
  );

  return {
    productType: productType ?? adapter.productTypes[0],
    stackId: adapter.id,
    dependencies,
    allowed,
    productionEligible,
    capabilityCeiling: allowed ? capabilityCeiling : "unsupported",
  };
}

/** Flattens a resolved graph into the evidence record a build must keep. */
export function buildDependencyEvidence(
  graph: StackDependencyGraph,
): DependencyEvidenceEntry[] {
  return graph.dependencies.map((node) => ({
    adapterId: node.adapterId,
    purpose: node.purpose,
    resolvedVersion: node.resolvedVersion,
    resolvedState: node.resolvedState,
    status: node.status,
  }));
}

/** The dependency nodes that actually stopped `graph.allowed` from being true. */
export function blockedDependencyNodes(
  graph: StackDependencyGraph,
): ResolvedDependencyNode[] {
  return graph.dependencies.filter((node) =>
    BLOCKING_STATUSES.has(node.status),
  );
}

/** A human-readable, non-stack-trace explanation of why a build was refused. */
export function describeBlockedDependencies(
  graph: StackDependencyGraph,
): string {
  const blocked = blockedDependencyNodes(graph);
  if (blocked.length === 0) {
    return `Stack "${graph.stackId}" has no blocked external dependencies.`;
  }
  return blocked
    .map((node) => `${node.adapterId} (${node.status}): ${node.message}`)
    .join(" ");
}
