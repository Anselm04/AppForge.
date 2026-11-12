import { getStackAdapter } from "./stackAdapters.js";

export type StackCapabilityRequirement = {
  id: string;
  description: string;
  requiredEvidence: string;
};

export type StackCapabilityContract = {
  stackId: string;
  generationMode: "runnable" | "structural";
  certificationLevel: "runnable_candidate" | "source_only";
  canClaimProductionReadyWithoutExecution: false;
  requiredChecks: StackCapabilityRequirement[];
  releaseRequirements: string[];
};

/**
 * Capability contracts describe what must be EXECUTED. They do not certify a
 * stack from its registry metadata or from AI-authored claims.
 */
export function stackCapabilityContract(
  stackId: string,
): StackCapabilityContract {
  const adapter = getStackAdapter(stackId);
  const requiredChecks: StackCapabilityRequirement[] = [
    {
      id: "source_integrity",
      description: "Persist a content-addressed artifact with complete files",
      requiredEvidence: "Current snapshot ID, version and SHA-256",
    },
    {
      id: "build",
      description: "Run the native toolchain against the generated project",
      requiredEvidence: "Actual command, exit code and bounded output logs",
    },
    {
      id: "security",
      description: "Verify dependency and application security",
      requiredEvidence: "Real scan results tied to artifact SHA-256",
    },
  ];

  const releaseRequirements: string[] = [];
  if (adapter.runtime === "mobile") {
    requiredChecks.push(
      {
        id: "flutter_or_native_analysis",
        description: "Run the platform's native static analysis and tests",
        requiredEvidence: "Flutter analyze/test or equivalent platform-native output",
      },
      {
        id: "native_build",
        description: "Create a runnable artifact for each supported target",
        requiredEvidence: "Verified platform build exit codes and produced binaries",
      },
      {
        id: "api_integration",
        description: "Execute real backend integration tests when a backend is required",
        requiredEvidence: "Authenticated real HTTP and persistence test results",
      },
    );
    releaseRequirements.push(
      "Customer-controlled signing credentials and identities",
      "Apple/Google store metadata, privacy disclosures and compliance",
      "Actual submission and provider review/approval evidence",
    );
  } else if (adapter.runtime === "browser" || adapter.previewMode === "vite" || adapter.previewMode === "next") {
    requiredChecks.push({
      id: "browser_runtime",
      description: "Open the generated application in a real browser",
      requiredEvidence: "Browser navigation, asset requests and runtime error report",
    });
  } else {
    requiredChecks.push({
      id: "service_runtime",
      description: "Start and exercise generated service endpoints",
      requiredEvidence: "Real HTTP health and behavioral test output",
    });
  }

  if (adapter.artifactKind === "web" || adapter.artifactKind === "service") {
    requiredChecks.push({
      id: "data_persistence",
      description: "Verify database operations if persistence is requested",
      requiredEvidence: "Real write/read and restart/recovery verification",
    });
  }

  return {
    stackId: adapter.id,
    generationMode: adapter.generationMode,
    certificationLevel:
      adapter.generationMode === "runnable"
        ? "runnable_candidate"
        : "source_only",
    canClaimProductionReadyWithoutExecution: false,
    requiredChecks,
    releaseRequirements,
  };
}
