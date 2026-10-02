/**
 * Concrete registry of external technology adapters AppForge can orchestrate.
 * Each entry describes how to discover, provision, invoke, test and certify
 * one external technology. States are intentionally conservative: an entry
 * only claims a state this codebase can currently back with real evidence
 * (e.g. an existing, tested stack adapter or build path). Everything else
 * starts at "discovered" until a provisioning/build/test harness exists.
 */

import type {
  AdapterCategory,
  AdapterEvidence,
  TechnologyAdapterDescriptor,
} from "./adapterSdk.js";

export function adapter(
  input: Pick<
    TechnologyAdapterDescriptor,
    | "id"
    | "label"
    | "category"
    | "supportedVersions"
    | "latestCompatibleStableVersion"
    | "supportedPlatforms"
    | "supportedArchitectures"
    | "installation"
    | "authentication"
    | "commands"
    | "capabilityTests"
    | "securityChecks"
  > &
    Partial<
      Pick<
        TechnologyAdapterDescriptor,
        | "state"
        | "evidence"
        | "lifecycleStatus"
        | "deprecationNotice"
        | "eolDate"
        | "evidenceRequirements"
        | "replacementPath"
        | "lastVerifiedAt"
      >
    >,
): TechnologyAdapterDescriptor {
  return {
    version: 1,
    lifecycleStatus: "active",
    deprecationNotice: null,
    eolDate: null,
    evidenceRequirements: [
      "discovered",
      "installVerified",
      "compileOrBuildVerified",
      "runtimeVerified",
    ],
    replacementPath: {
      successorAvailable: false,
      successorIdentifier: null,
      migrationNotes: null,
    },
    state: "discovered",
    evidence: { discovered: true },
    quarantine: null,
    lastVerifiedAt: null,
    ...input,
  };
}
