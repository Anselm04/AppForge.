import type { ProductContract, ProductType } from "./productContract.js";
import { getStackAdapter } from "./stackAdapters.js";
import {
  resolveStackDependencyGraph,
  type StackDependencyGraph,
} from "./stackDependencyResolver.js";

export const CERTIFICATION_STATUSES = [
  "structured",
  "generated",
  "runnable",
  "behaviorally-verified",
  "deployment-verified",
  "monetization-verified",
  "production-candidate",
  "production-certified",
] as const;

export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];

export type CertificationEvidence = {
  artifactPresent: boolean;
  generatedFileCount: number;
  requirementsResolved: boolean;
  behavioralTestsVerified: boolean;
  runtimeVerified: boolean;
  securityVerified: boolean;
  deploymentVerified: boolean;
  browserVerified?: boolean;
  healthVerified?: boolean;
  monetizationVerified?: boolean;
  operationalVerified: boolean;
  recoveryVerified: boolean;
};

export type CertificationRequirement =
  | "artifact"
  | "generation"
  | "requirements"
  | "behavior"
  | "runtime"
  | "security"
  | "auth_lifecycle"
  | "tenant_isolation"
  | "deployment"
  | "browser"
  | "health"
  | "monetization"
  | "operations"
  | "recovery"
  | "adapter_dependencies";

export type CertificationDecision = {
  status: CertificationStatus;
  productionCertified: boolean;
  productType: ProductType;
  stack: string;
  verificationMode: "browser" | "health" | "native";
  monetizationRequired: boolean;
  missingEvidence: CertificationRequirement[];
  dependencyGraph: StackDependencyGraph;
};

const BROWSER_PRODUCT_TYPES = new Set<ProductType>([
  "website",
  "saas_application",
  "game",
  "ecommerce_product",
  "data_product",
]);

function monetizationRequested(contract: ProductContract): boolean {
  return (
    contract.monetizationRequirements.length > 0 ||
    contract.secondaryCapabilities.includes("billing")
  );
}

function securityRequirementText(contract: ProductContract): string {
  return [
    ...contract.securityRequirements,
    ...contract.functionalRequirements
      .filter((item) => item.category === "security")
      .map((item) => item.text),
  ]
    .join("\n")
    .toLowerCase();
}

function authLifecycleRequested(contract: ProductContract): boolean {
  return (
    contract.secondaryCapabilities.includes("authentication") ||
    /\b(auth|authentication|login|session|oauth|sso|jwt|access control)\b/i.test(
      securityRequirementText(contract),
    )
  );
}

function tenantIsolationRequested(contract: ProductContract): boolean {
  return (
    contract.secondaryCapabilities.includes("teams") ||
    contract.userRoles.length > 1 ||
    /\b(tenant|organization|organisation|workspace|ownership|role[- ]based|rbac)\b/i.test(
      securityRequirementText(contract),
    )
  );
}

function verificationModeFor(
  contract: ProductContract,
): "browser" | "health" | "native" {
  const adapter = getStackAdapter(contract.selectedTechnologyStack);
  if (adapter.generationMode === "structural") return "native";
  if (adapter.previewMode === "service") return "health";
  return BROWSER_PRODUCT_TYPES.has(contract.productType) ? "browser" : "health";
}

function missingForProduction(
  contract: ProductContract,
  evidence: CertificationEvidence,
  dependencyGraph: StackDependencyGraph,
): CertificationRequirement[] {
  const adapter = getStackAdapter(contract.selectedTechnologyStack);
  const verificationMode = verificationModeFor(contract);
  const missing: CertificationRequirement[] = [];

  if (!evidence.artifactPresent) missing.push("artifact");
  if (evidence.generatedFileCount <= 0) missing.push("generation");
  if (!evidence.requirementsResolved) missing.push("requirements");
  if (!evidence.behavioralTestsVerified) missing.push("behavior");
  if (!evidence.runtimeVerified) missing.push("runtime");
  if (!evidence.securityVerified) missing.push("security");
  if (authLifecycleRequested(contract) && !evidence.securityVerified) {
    missing.push("auth_lifecycle");
  }
  if (tenantIsolationRequested(contract) && !evidence.securityVerified) {
    missing.push("tenant_isolation");
  }
  if (!evidence.deploymentVerified) missing.push("deployment");
  if (verificationMode === "browser" && evidence.browserVerified !== true) {
    missing.push("browser");
  }
  if (verificationMode === "health" && evidence.healthVerified !== true) {
    missing.push("health");
  }
  if (
    monetizationRequested(contract) &&
    evidence.monetizationVerified !== true
  ) {
    missing.push("monetization");
  }
  if (!evidence.operationalVerified) missing.push("operations");
  if (!evidence.recoveryVerified) missing.push("recovery");

  if (adapter.generationMode === "structural") {
    if (!missing.includes("runtime")) missing.push("runtime");
    if (!missing.includes("deployment")) missing.push("deployment");
  }

  if (!dependencyGraph.productionEligible) {
    missing.push("adapter_dependencies");
  }

  return missing;
}

export function evaluateCertification(input: {
  productContract: ProductContract;
  evidence: CertificationEvidence;
  /** Pass a precomputed graph to avoid re-resolving it; otherwise it is resolved here. */
  dependencyGraph?: StackDependencyGraph;
}): CertificationDecision {
  const { productContract: contract, evidence } = input;
  const adapter = getStackAdapter(contract.selectedTechnologyStack);
  const verificationMode = verificationModeFor(contract);
  const monetizationRequired = monetizationRequested(contract);
  const dependencyGraph =
    input.dependencyGraph ??
    resolveStackDependencyGraph(
      contract.selectedTechnologyStack,
      contract.productType,
    );
  const missingEvidence = missingForProduction(
    contract,
    evidence,
    dependencyGraph,
  );

  let status: CertificationStatus = "structured";
  if (evidence.artifactPresent && evidence.generatedFileCount > 0) {
    status = "generated";
  }

  if (adapter.generationMode === "runnable" && evidence.runtimeVerified) {
    status = "runnable";
  }

  if (
    status === "runnable" &&
    evidence.requirementsResolved &&
    evidence.behavioralTestsVerified
  ) {
    status = "behaviorally-verified";
  }

  if (
    status === "behaviorally-verified" &&
    evidence.deploymentVerified &&
    (verificationMode !== "browser" || evidence.browserVerified === true) &&
    (verificationMode !== "health" || evidence.healthVerified === true)
  ) {
    status = "deployment-verified";
  }

  if (
    status === "deployment-verified" &&
    monetizationRequired &&
    evidence.monetizationVerified === true
  ) {
    status = "monetization-verified";
  }

  const productionCandidate =
    adapter.generationMode === "runnable" &&
    evidence.artifactPresent &&
    evidence.generatedFileCount > 0 &&
    evidence.requirementsResolved &&
    evidence.behavioralTestsVerified &&
    evidence.runtimeVerified &&
    evidence.securityVerified &&
    evidence.recoveryVerified &&
    dependencyGraph.allowed;

  const productionCertified =
    productionCandidate && missingEvidence.length === 0;

  if (productionCertified) {
    status = "production-certified";
  } else if (productionCandidate) {
    status = "production-candidate";
  }

  return {
    status,
    productionCertified,
    productType: contract.productType,
    stack: adapter.id,
    verificationMode,
    monetizationRequired,
    missingEvidence,
    dependencyGraph,
  };
}

export function assertProductionCertified(
  decision: CertificationDecision,
): void {
  if (!decision.productionCertified) {
    throw new Error(
      `Production certification evidence is incomplete: ${decision.missingEvidence.join(", ") || "unknown"}`,
    );
  }
}

export function requirementBehaviorVerified(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const manifest = input as {
    unresolvedMustHaveIds?: unknown;
    requirements?: Array<{
      priority?: string;
      status?: string;
      tests?: unknown[];
      validationEvidence?: Array<{ passed?: boolean }>;
    }>;
  };
  if (
    !Array.isArray(manifest.unresolvedMustHaveIds) ||
    manifest.unresolvedMustHaveIds.length > 0 ||
    !Array.isArray(manifest.requirements) ||
    manifest.requirements.length === 0
  ) {
    return false;
  }

  return manifest.requirements
    .filter((requirement) => requirement.priority === "must")
    .every(
      (requirement) =>
        (requirement.status === "validated" ||
          requirement.status === "deployed") &&
        Array.isArray(requirement.tests) &&
        requirement.tests.length > 0 &&
        Array.isArray(requirement.validationEvidence) &&
        requirement.validationEvidence.some((item) => item.passed === true),
    );
}

export function hasVerifiedMonetizationEvidence(
  events: readonly {
    kind?: string | null;
    artifactVersion?: number | null;
    payload?: unknown;
  }[],
  artifactVersion: number,
): boolean {
  return events.some((event) => {
    if (
      event.kind !== "monetization" ||
      event.artifactVersion !== artifactVersion ||
      !event.payload ||
      typeof event.payload !== "object"
    ) {
      return false;
    }
    const payload = event.payload as Record<string, unknown>;
    if (payload.verified !== true) return false;

    const hasDetailedLifecycleEvidence =
      "configured" in payload ||
      "providerVerified" in payload ||
      "state" in payload;
    if (!hasDetailedLifecycleEvidence) {
      return true;
    }

    return (
      payload.configured === true &&
      payload.providerVerified === true &&
      payload.state === "connected"
    );
  });
}
