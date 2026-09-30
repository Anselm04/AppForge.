import {
  productContractSchema,
  type ProductContract,
} from "./productContract.js";
import { productPlanSchema, type ProductPlan } from "./productPlan.js";
import { agentCoordinationRecordSchema } from "./agentCoordination.js";
import { requirementManifestSchema } from "./requirementManifest.js";
import { inspectIncompleteProduct } from "./incompleteProduct.js";
import {
  requirementBehaviorVerified,
  type CertificationDecision,
} from "./certificationLogic.js";

export const FINAL_PRODUCT_FACTORY_STEPS = [
  "contract_validated",
  "ambiguity_resolved",
  "stack_selected",
  "live_research",
  "architecture_defined",
  "implementation_plan_validated",
  "specialist_agents_completed",
  "real_source_files_generated",
  "artifact_persisted",
  "stack_and_requirements_preserved",
  "placeholders_blocked",
  "requirement_linked_evidence",
  "isolated_build_verified",
  "runtime_verified",
  "preview_verified",
  "validated_artifact_deployed",
  "live_product_verified",
  "monetization_and_entitlements_verified",
  "monitoring_verified",
  "recovery_verified",
  "honest_certification",
  "limitations_exposed",
] as const;

export type FinalProductFactoryStepId =
  (typeof FINAL_PRODUCT_FACTORY_STEPS)[number];

export type FinalProductFactoryStep = {
  id: FinalProductFactoryStepId;
  complete: boolean;
  applicable: boolean;
  detail: string;
};

export type FinalProductFactoryFlowReport = {
  version: 1;
  productionReady: boolean;
  certificationStatus: string;
  productType: string | null;
  selectedTechnologyStack: string | null;
  steps: FinalProductFactoryStep[];
  incompleteSteps: FinalProductFactoryStepId[];
  limitations: string[];
};

type ProjectFlowState = {
  description?: string | null;
  techStack?: string | null;
  productContract?: unknown;
  promptIntent?: unknown;
  researchRecord?: unknown;
  productPlan?: unknown;
  agentCoordination?: unknown;
  requirementManifest?: unknown;
};

type ArtifactFlowState = {
  version: number;
  integrity?: { sha256?: string | null } | null;
  files: Record<string, string>;
  validationResult?: unknown;
  requirementManifest?: unknown;
};

type DeploymentFlowState = {
  liveUrl?: string;
  artifactVersion?: number;
  persistedArtifactSha256?: string;
  artifactSha256?: string;
  httpVerified?: boolean;
  browserVerified?: boolean;
  verification?: string;
  healthPathsVerified?: string[];
  operationalVerified?: boolean;
};

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function validationPassed(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { passed?: unknown }).passed === true
  );
}

function isIsolatedValidation(value: unknown): boolean {
  if (!validationPassed(value)) return false;
  const result = value as { warning?: unknown; stage?: unknown };
  const warning = typeof result.warning === "string" ? result.warning : "";
  const stage = typeof result.stage === "string" ? result.stage : "";
  return (
    /isolated production validation passed/i.test(warning) ||
    /docker sandbox passed/i.test(warning) ||
    /isolat/i.test(stage)
  );
}

function codeFileCount(files: Record<string, string>): number {
  return Object.entries(files).filter(
    ([path, source]) =>
      /\.(?:[cm]?[jt]sx?|py|dart|rs|go|java|kt|swift|html|css|sql|prisma)$/i.test(
        path,
      ) &&
      source.trim().length > 0,
  ).length;
}

function researchComplete(value: unknown, contract: ProductContract): boolean {
  if (!value || typeof value !== "object") return false;
  const research = value as {
    originalPrompt?: unknown;
    productType?: unknown;
    selectedTechnologyStack?: unknown;
    queries?: unknown;
    sources?: unknown;
    decisions?: unknown;
    searchedAt?: unknown;
  };
  return (
    research.originalPrompt === contract.originalPrompt &&
    research.productType === contract.productType &&
    research.selectedTechnologyStack === contract.selectedTechnologyStack &&
    Array.isArray(research.queries) &&
    research.queries.length > 0 &&
    Array.isArray(research.sources) &&
    research.sources.length > 0 &&
    Array.isArray(research.decisions) &&
    nonEmpty(research.searchedAt)
  );
}

function ambiguityResolved(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const intent = value as {
    ambiguous?: unknown;
    primaryProductType?: unknown;
    clarificationQuestions?: unknown;
  };
  return intent.ambiguous === false && nonEmpty(intent.primaryProductType);
}

function coordinationComplete(
  value: unknown,
  plan: ProductPlan,
  files: Record<string, string>,
): boolean {
  const parsed = agentCoordinationRecordSchema.safeParse(value);
  if (!parsed.success) return false;
  const record = parsed.data;
  const taskStates = Object.values(record.taskStates);
  if (taskStates.length !== plan.tasks.length || taskStates.length === 0) {
    return false;
  }
  return taskStates.every(
    (state) =>
      state.status === "completed" &&
      state.outputFiles.length > 0 &&
      state.outputFiles.every(
        (path) =>
          typeof files[path] === "string" && files[path].trim().length > 0,
      ),
  );
}

function preservationComplete(input: {
  project: ProjectFlowState;
  contract: ProductContract;
  plan: ProductPlan;
  manifest: ReturnType<typeof requirementManifestSchema.parse>;
}): boolean {
  const { project, contract, plan, manifest } = input;
  if (
    project.description !== contract.originalPrompt ||
    project.techStack !== contract.selectedTechnologyStack ||
    plan.productType !== contract.productType ||
    plan.selectedTechnologyStack !== contract.selectedTechnologyStack ||
    manifest.productType !== contract.productType ||
    manifest.selectedTechnologyStack !== contract.selectedTechnologyStack ||
    manifest.originalPrompt !== contract.originalPrompt
  ) {
    return false;
  }
  const contractIds = contract.functionalRequirements
    .map((requirement) => requirement.id)
    .sort();
  const manifestIds = manifest.requirements
    .map((requirement) => requirement.id)
    .sort();
  return JSON.stringify(contractIds) === JSON.stringify(manifestIds);
}

export function evaluateFinalProductFactoryFlow(input: {
  project: ProjectFlowState;
  artifact: ArtifactFlowState | null;
  certificationDecision: CertificationDecision;
  deployment?: DeploymentFlowState | null;
  monetizationVerified: boolean;
  recoveryVerified: boolean;
}): FinalProductFactoryFlowReport {
  const parsedContract = productContractSchema.safeParse(
    input.project.productContract,
  );
  const contract = parsedContract.success ? parsedContract.data : null;
  const parsedPlan =
    contract === null
      ? null
      : productPlanSchema.safeParse(input.project.productPlan);
  const plan = parsedPlan?.success ? parsedPlan.data : null;
  const manifestInput =
    input.artifact?.requirementManifest ?? input.project.requirementManifest;
  const parsedManifest = requirementManifestSchema.safeParse(manifestInput);
  const manifest = parsedManifest.success ? parsedManifest.data : null;
  const files = input.artifact?.files ?? {};
  const deployment = input.deployment ?? null;
  const monetizationRequired =
    contract !== null &&
    (contract.monetizationRequirements.length > 0 ||
      contract.secondaryCapabilities.includes("billing"));

  let placeholdersBlocked = false;
  if (contract && plan && input.artifact) {
    try {
      placeholdersBlocked = inspectIncompleteProduct({
        files,
        productContract: contract,
        productPlan: plan,
      }).complete;
    } catch {
      placeholdersBlocked = false;
    }
  }

  const runtimeVerified =
    input.artifact !== null &&
    validationPassed(input.artifact.validationResult) &&
    !input.certificationDecision.missingEvidence.includes("runtime");
  const deploymentVerified =
    deployment?.httpVerified === true &&
    !input.certificationDecision.missingEvidence.includes("deployment");
  const liveVerified =
    deploymentVerified &&
    (input.certificationDecision.verificationMode === "browser"
      ? deployment?.browserVerified === true
      : input.certificationDecision.verificationMode === "health"
        ? (deployment?.healthPathsVerified?.length ?? 0) > 0
        : runtimeVerified);
  const previewVerified =
    deploymentVerified &&
    nonEmpty(deployment?.liveUrl) &&
    nonEmpty(deployment?.artifactSha256);

  const steps: FinalProductFactoryStep[] = [
    {
      id: "contract_validated",
      complete: parsedContract.success,
      applicable: true,
      detail: parsedContract.success
        ? "Canonical product contract is valid."
        : "Canonical product contract is missing or invalid.",
    },
    {
      id: "ambiguity_resolved",
      complete: ambiguityResolved(input.project.promptIntent),
      applicable: true,
      detail: ambiguityResolved(input.project.promptIntent)
        ? "Prompt intent is resolved to one primary product type."
        : "Prompt intent is still ambiguous or missing.",
    },
    {
      id: "stack_selected",
      complete:
        contract !== null &&
        nonEmpty(contract.selectedTechnologyStack) &&
        input.project.techStack === contract.selectedTechnologyStack,
      applicable: true,
      detail: "Selected stack must match the canonical contract.",
    },
    {
      id: "live_research",
      complete:
        contract !== null &&
        researchComplete(input.project.researchRecord, contract),
      applicable: true,
      detail:
        "Live research must be persisted and bound to this prompt/product/stack.",
    },
    {
      id: "architecture_defined",
      complete: plan !== null && nonEmpty(plan.architecture.summary),
      applicable: true,
      detail: "Validated plan must contain a complete architecture.",
    },
    {
      id: "implementation_plan_validated",
      complete: plan !== null,
      applicable: true,
      detail: "Implementation plan must pass the canonical plan schema.",
    },
    {
      id: "specialist_agents_completed",
      complete:
        plan !== null &&
        coordinationComplete(input.project.agentCoordination, plan, files),
      applicable: true,
      detail:
        "Every planned specialist task must complete with persisted output files.",
    },
    {
      id: "real_source_files_generated",
      complete: codeFileCount(files) > 0,
      applicable: true,
      detail: "Artifact must contain substantive source files.",
    },
    {
      id: "artifact_persisted",
      complete:
        input.artifact !== null &&
        Number.isInteger(input.artifact.version) &&
        input.artifact.version > 0 &&
        !!input.artifact.integrity?.sha256,
      applicable: true,
      detail: "Immutable artifact version and integrity hash must exist.",
    },
    {
      id: "stack_and_requirements_preserved",
      complete:
        contract !== null &&
        plan !== null &&
        manifest !== null &&
        preservationComplete({
          project: input.project,
          contract,
          plan,
          manifest,
        }),
      applicable: true,
      detail:
        "Prompt, stack, product type, and requirement IDs must remain unchanged end-to-end.",
    },
    {
      id: "placeholders_blocked",
      complete: placeholdersBlocked,
      applicable: true,
      detail:
        "Final generated artifact must pass incomplete-product/placeholder protection.",
    },
    {
      id: "requirement_linked_evidence",
      complete: manifest !== null && requirementBehaviorVerified(manifest),
      applicable: true,
      detail:
        "Every must-have requirement needs linked implementation, tests, and passing validation evidence.",
    },
    {
      id: "isolated_build_verified",
      complete:
        input.artifact !== null &&
        isIsolatedValidation(input.artifact.validationResult),
      applicable: true,
      detail: "Generated code must pass an isolated production build boundary.",
    },
    {
      id: "runtime_verified",
      complete: runtimeVerified,
      applicable: true,
      detail: "Selected stack runtime must be verified.",
    },
    {
      id: "preview_verified",
      complete: previewVerified,
      applicable: true,
      detail:
        "The exact generated artifact must be reachable before final live certification.",
    },
    {
      id: "validated_artifact_deployed",
      complete:
        deploymentVerified &&
        input.artifact !== null &&
        deployment?.artifactVersion === input.artifact.version &&
        deployment?.persistedArtifactSha256 ===
          input.artifact.integrity?.sha256,
      applicable: true,
      detail:
        "Deployment must be bound to the current validated artifact version and SHA-256.",
    },
    {
      id: "live_product_verified",
      complete: liveVerified,
      applicable: true,
      detail:
        "Live HTTP plus browser/health verification must pass for the selected product type.",
    },
    {
      id: "monetization_and_entitlements_verified",
      complete: !monetizationRequired || input.monetizationVerified,
      applicable: monetizationRequired,
      detail: monetizationRequired
        ? "Requested billing must be provider-verified and entitlement-enforced."
        : "Monetization was not requested.",
    },
    {
      id: "monitoring_verified",
      complete: deployment?.operationalVerified === true,
      applicable: true,
      detail: "Operational verification/monitoring must be live.",
    },
    {
      id: "recovery_verified",
      complete: input.recoveryVerified,
      applicable: true,
      detail:
        "Known-good recovery checkpoint must be recorded for the exact artifact.",
    },
    {
      id: "honest_certification",
      complete: input.certificationDecision.productionCertified
        ? input.certificationDecision.missingEvidence.length === 0
        : input.certificationDecision.missingEvidence.length > 0,
      applicable: true,
      detail:
        "Certification must reflect the evidence without upgrading missing proof.",
    },
    {
      id: "limitations_exposed",
      complete: true,
      applicable: true,
      detail:
        "This report explicitly exposes every incomplete applicable step.",
    },
  ];

  const incompleteSteps = steps
    .filter((step) => step.applicable && !step.complete)
    .map((step) => step.id);
  const limitations = steps
    .filter((step) => step.applicable && !step.complete)
    .map((step) => step.detail);

  const productionReady =
    input.certificationDecision.productionCertified &&
    incompleteSteps.length === 0;

  return {
    version: 1,
    productionReady,
    certificationStatus: input.certificationDecision.status,
    productType: contract?.productType ?? null,
    selectedTechnologyStack: contract?.selectedTechnologyStack ?? null,
    steps,
    incompleteSteps,
    limitations,
  };
}
