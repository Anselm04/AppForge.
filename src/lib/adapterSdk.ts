/**
 * Universal adapter SDK. AppForge owns product understanding, planning,
 * orchestration, permissions, credentials, budgets, testing, evidence and
 * certification. External technologies (engines, SDKs, clouds, databases,
 * AI providers, toolchains) stay external and are described, provisioned,
 * invoked, tested and certified through versioned adapters — never embedded
 * or forked into the AppForge core.
 *
 * A technology is never "supported" merely because an adapter file exists.
 * Every capability state below requires the evidence the state name implies.
 */

/** Ordered lifecycle of trust for an adapter's ability to deliver a given capability. */
export const ADAPTER_CAPABILITY_STATES = [
  "unsupported",
  "discovered",
  "experimental",
  "structural",
  "buildable",
  "runnable",
  "packageable",
  "deployable",
  "verified",
  "production-certified",
] as const;

export type AdapterCapabilityState = (typeof ADAPTER_CAPABILITY_STATES)[number];

const STATE_RANK: Record<AdapterCapabilityState, number> = Object.fromEntries(
  ADAPTER_CAPABILITY_STATES.map((state, index) => [state, index]),
) as Record<AdapterCapabilityState, number>;

export function stateRank(state: AdapterCapabilityState): number {
  return STATE_RANK[state];
}

export function isAtLeast(
  state: AdapterCapabilityState,
  floor: AdapterCapabilityState,
): boolean {
  return stateRank(state) >= stateRank(floor);
}

export type AdapterCategory =
  | "game_engine"
  | "mobile_toolchain"
  | "desktop_toolchain"
  | "content_tool"
  | "database"
  | "cloud_platform"
  | "compiler_runtime"
  | "ai_provider"
  | "deployment_target"
  | "hardware_toolchain";

export type AdapterLifecycleStatus = "active" | "deprecated" | "retired";

export type AdapterPlatform =
  "linux" | "windows" | "macos" | "android" | "ios" | "web" | "embedded";

export type AdapterArchitecture = "x86_64" | "arm64" | "arm" | "wasm";

/**
 * Evidence a specific capability state requires before an adapter may be
 * promoted to it. Each flag must be backed by a real, reproducible check —
 * never inferred from the mere existence of adapter metadata.
 */
export type AdapterEvidence = {
  discovered?: boolean;
  installVerified?: boolean;
  compileOrBuildVerified?: boolean;
  testsVerified?: boolean;
  runtimeVerified?: boolean;
  packageVerified?: boolean;
  deploymentVerified?: boolean;
  securityScanVerified?: boolean;
  behavioralVerified?: boolean;
  reproducibleBuild?: boolean;
  evidenceLedgerIds?: string[];
};

const EVIDENCE_REQUIRED_FOR_STATE: Partial<
  Record<AdapterCapabilityState, Array<keyof AdapterEvidence>>
> = {
  discovered: ["discovered"],
  experimental: ["discovered", "installVerified"],
  structural: ["discovered", "installVerified"],
  buildable: ["discovered", "installVerified", "compileOrBuildVerified"],
  runnable: [
    "discovered",
    "installVerified",
    "compileOrBuildVerified",
    "runtimeVerified",
  ],
  packageable: [
    "discovered",
    "installVerified",
    "compileOrBuildVerified",
    "runtimeVerified",
    "packageVerified",
  ],
  deployable: [
    "discovered",
    "installVerified",
    "compileOrBuildVerified",
    "runtimeVerified",
    "packageVerified",
    "deploymentVerified",
  ],
  verified: [
    "discovered",
    "installVerified",
    "compileOrBuildVerified",
    "runtimeVerified",
    "packageVerified",
    "deploymentVerified",
    "testsVerified",
    "securityScanVerified",
    "behavioralVerified",
  ],
  "production-certified": [
    "discovered",
    "installVerified",
    "compileOrBuildVerified",
    "runtimeVerified",
    "packageVerified",
    "deploymentVerified",
    "testsVerified",
    "securityScanVerified",
    "behavioralVerified",
    "reproducibleBuild",
  ],
};

export type AdapterPromotionResult =
  | { ok: true; state: AdapterCapabilityState }
  | {
      ok: false;
      reason: string;
      missingEvidence: Array<keyof AdapterEvidence>;
    };

/**
 * Checks whether `evidence` justifies promoting to `targetState`. Promotion
 * must be monotonic (no skipping ahead without evidence for every
 * intermediate requirement) and every claimed state must be re-derivable
 * from the evidence alone, not from the previous state.
 */
export function evaluateAdapterPromotion(
  currentState: AdapterCapabilityState,
  targetState: AdapterCapabilityState,
  evidence: AdapterEvidence,
): AdapterPromotionResult {
  if (stateRank(targetState) <= stateRank(currentState)) {
    return {
      ok: false,
      reason: `${targetState} is not an advance beyond current state ${currentState}`,
      missingEvidence: [],
    };
  }
  const required = EVIDENCE_REQUIRED_FOR_STATE[targetState] ?? [];
  const missingEvidence = required.filter((flag) => evidence[flag] !== true);
  if (missingEvidence.length > 0) {
    return {
      ok: false,
      reason: `Missing evidence for state ${targetState}: ${missingEvidence.join(", ")}`,
      missingEvidence,
    };
  }
  return { ok: true, state: targetState };
}

export type AdapterRuntimeCommands = {
  install: string[];
  build: string | null;
  test: string | null;
  runtime: string | null;
  packaging: string | null;
  deploy: string | null;
  healthCheck: string | null;
};

export type AdapterReplacementPath = {
  /** True when a newer version/provider is known to exist. */
  successorAvailable: boolean;
  successorIdentifier: string | null;
  migrationNotes: string | null;
};

/**
 * Describes one external technology (engine, SDK, database, cloud, AI
 * provider, toolchain, etc.) that AppForge can orchestrate. The adapter
 * never contains the technology itself — only how to discover, provision,
 * invoke, test and certify it.
 */
export type TechnologyAdapterDescriptor = {
  id: string;
  label: string;
  category: AdapterCategory;
  version: 1;
  /** Versions of the external technology this adapter has been written against. */
  supportedVersions: string[];
  latestCompatibleStableVersion: string | null;
  lifecycleStatus: AdapterLifecycleStatus;
  deprecationNotice: string | null;
  eolDate: string | null;
  supportedPlatforms: AdapterPlatform[];
  supportedArchitectures: AdapterArchitecture[];
  installation: {
    method: string;
    requiresProvisioning: boolean;
    requiredToolchain: string[];
  };
  authentication: {
    required: boolean;
    kind: "none" | "api_key" | "oauth" | "service_account" | "license_key";
    credentialIsolation:
      "disposable_runner" | "scoped_secret" | "not_applicable";
  };
  commands: AdapterRuntimeCommands;
  capabilityTests: string[];
  securityChecks: string[];
  evidenceRequirements: Array<keyof AdapterEvidence>;
  replacementPath: AdapterReplacementPath;
  /** Current promotion state. Must only move via evaluateAdapterPromotion. */
  state: AdapterCapabilityState;
  evidence: AdapterEvidence;
  /** Set when an adapter was demoted after a regression (see quarantineAdapter). */
  quarantine: { quarantined: boolean; reason: string | null } | null;
  lastVerifiedAt: string | null;
};

/**
 * Demotes an adapter after a regression (e.g. a previously verified compiler
 * version stops building). Quarantine never deletes the adapter — it stops
 * AppForge from routing production builds to it until re-verified.
 */
export function quarantineAdapter(
  adapter: TechnologyAdapterDescriptor,
  reason: string,
): TechnologyAdapterDescriptor {
  const safeState: AdapterCapabilityState = isAtLeast(
    adapter.state,
    "structural",
  )
    ? "experimental"
    : adapter.state;
  return {
    ...adapter,
    state: safeState,
    quarantine: { quarantined: true, reason },
  };
}

export function clearQuarantine(
  adapter: TechnologyAdapterDescriptor,
): TechnologyAdapterDescriptor {
  return { ...adapter, quarantine: null };
}

export function applyAdapterPromotion(
  adapter: TechnologyAdapterDescriptor,
  targetState: AdapterCapabilityState,
  evidence: AdapterEvidence,
  verifiedAt: string,
): TechnologyAdapterDescriptor {
  const mergedEvidence = { ...adapter.evidence, ...evidence };
  const result = evaluateAdapterPromotion(
    adapter.state,
    targetState,
    mergedEvidence,
  );
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return {
    ...adapter,
    state: result.state,
    evidence: mergedEvidence,
    lastVerifiedAt: verifiedAt,
    quarantine: null,
  };
}
