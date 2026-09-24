import { createHash } from "node:crypto";
import { z } from "zod";
import {
  validateProductContract,
  type ProductContract,
  type ProductRequirement,
} from "./productContract.js";
import type { ProductPlan } from "./productPlan.js";

export const requirementStatusSchema = z.enum([
  "pending",
  "planned",
  "implemented",
  "tested",
  "validated",
  "deployed",
  "blocked",
]);

export type RequirementStatus = z.infer<typeof requirementStatusSchema>;

const requirementValidationEvidenceSchema = z.object({
  stage: z.string().min(1),
  passed: z.boolean(),
  at: z.string().min(1),
  errors: z.array(z.string()),
});

const requirementDeploymentEvidenceSchema = z.object({
  destination: z.string().min(1),
  url: z.string().min(1),
  verified: z.boolean(),
  at: z.string().min(1),
});

const requirementChangeSchema = z.object({
  revision: z.number().int().positive(),
  requirementId: z.string().regex(/^REQ-\d{3}$/),
  type: z.enum(["added", "removed", "modified", "remapped"]),
  at: z.string().min(1),
  detail: z.string().min(1),
});

export const requirementManifestEntrySchema = z.object({
  id: z.string().regex(/^REQ-\d{3}$/),
  text: z.string().min(1),
  priority: z.enum(["must", "should", "could"]),
  category: z.enum([
    "workflow",
    "quality",
    "security",
    "monetization",
    "operations",
  ]),
  source: z.literal("canonical_product_contract"),
  sourceField: z.literal("functionalRequirements"),
  taskIds: z.array(z.string().min(1)),
  files: z.array(z.string().min(1)),
  tests: z.array(z.string().min(1)),
  validations: z.array(z.string().min(1)),
  implementationHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  validationEvidence: z.array(requirementValidationEvidenceSchema),
  deploymentEvidence: z.array(requirementDeploymentEvidenceSchema),
  status: requirementStatusSchema,
  unresolvedReason: z.string().min(1).nullable(),
});

export const requirementManifestSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().positive(),
  productType: z.string().min(1),
  selectedTechnologyStack: z.string().min(1),
  originalPrompt: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  requirements: z.array(requirementManifestEntrySchema).min(1),
  changes: z.array(requirementChangeSchema),
  unresolvedMustHaveIds: z.array(z.string().regex(/^REQ-\d{3}$/)),
});

export type RequirementManifest = z.infer<typeof requirementManifestSchema>;
export type RequirementManifestEntry = z.infer<
  typeof requirementManifestEntrySchema
>;

type ValidationEvidenceInput = {
  passed: boolean;
  stage: string;
  errors?: string[];
};

type DeploymentEvidenceInput = {
  destination: string;
  url: string;
  verified: boolean;
  at?: string;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function requirementShape(requirement: ProductRequirement): string {
  return JSON.stringify({
    text: requirement.text,
    priority: requirement.priority,
    category: requirement.category,
  });
}

function mappingShape(entry: {
  taskIds: string[];
  files: string[];
  validations: string[];
}): string {
  return JSON.stringify({
    taskIds: entry.taskIds,
    files: entry.files,
    validations: entry.validations,
  });
}

function unresolvedMustHaveIds(
  requirements: RequirementManifestEntry[],
): string[] {
  return requirements
    .filter(
      (requirement) =>
        requirement.priority === "must" &&
        requirement.status !== "validated" &&
        requirement.status !== "deployed",
    )
    .map((requirement) => requirement.id);
}

function withUnresolvedState(
  manifest: Omit<RequirementManifest, "unresolvedMustHaveIds">,
): RequirementManifest {
  return requirementManifestSchema.parse({
    ...manifest,
    unresolvedMustHaveIds: unresolvedMustHaveIds(manifest.requirements),
  });
}

function compareRequirements(
  previous: RequirementManifest | undefined,
  contract: ProductContract,
  plan: ProductPlan,
  revision: number,
  at: string,
): RequirementManifest["changes"] {
  if (!previous) {
    return contract.functionalRequirements.map((requirement) => ({
      revision,
      requirementId: requirement.id,
      type: "added" as const,
      at,
      detail: "Requirement created from the canonical product contract.",
    }));
  }

  const changes: RequirementManifest["changes"] = [];
  const previousById = new Map(
    previous.requirements.map((requirement) => [requirement.id, requirement]),
  );
  const currentIds = new Set(
    contract.functionalRequirements.map((requirement) => requirement.id),
  );

  for (const requirement of contract.functionalRequirements) {
    const prior = previousById.get(requirement.id);
    const taskIds = plan.requirementToTasks[requirement.id] ?? [];
    const files = unique(
      taskIds.flatMap((taskId) => plan.taskToFiles[taskId] ?? []),
    );
    const validations = unique(
      taskIds.flatMap((taskId) => plan.taskToValidation[taskId] ?? []),
    );

    if (!prior) {
      changes.push({
        revision,
        requirementId: requirement.id,
        type: "added",
        at,
        detail: "Requirement added to the canonical product contract.",
      });
      continue;
    }

    if (requirementShape(requirement) !== requirementShape(prior)) {
      changes.push({
        revision,
        requirementId: requirement.id,
        type: "modified",
        at,
        detail:
          "Requirement text, priority, or category changed in the canonical product contract.",
      });
    }

    if (
      mappingShape({ taskIds, files, validations }) !==
      mappingShape({
        taskIds: prior.taskIds,
        files: prior.files,
        validations: prior.validations,
      })
    ) {
      changes.push({
        revision,
        requirementId: requirement.id,
        type: "remapped",
        at,
        detail:
          "Requirement planner task/file/validation mappings changed.",
      });
    }
  }

  for (const prior of previous.requirements) {
    if (!currentIds.has(prior.id)) {
      changes.push({
        revision,
        requirementId: prior.id,
        type: "removed",
        at,
        detail: "Requirement removed from the canonical product contract.",
      });
    }
  }

  return changes;
}

export function createRequirementManifest(input: {
  productContract: ProductContract;
  productPlan: ProductPlan;
  previous?: RequirementManifest | null;
  now?: string;
}): RequirementManifest {
  const contract = validateProductContract(input.productContract);
  const previous = input.previous
    ? requirementManifestSchema.parse(input.previous)
    : undefined;
  const now = input.now ?? new Date().toISOString();

  const ids = contract.functionalRequirements.map((requirement) => requirement.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Requirement IDs must be unique in the canonical product contract");
  }

  const provisionalRevision = (previous?.revision ?? 0) + 1;
  const changes = compareRequirements(
    previous,
    contract,
    input.productPlan,
    provisionalRevision,
    now,
  );
  const revision =
    previous && changes.length === 0 ? previous.revision : provisionalRevision;

  const previousById = new Map(
    previous?.requirements.map((requirement) => [requirement.id, requirement]) ??
      [],
  );

  const requirements: RequirementManifestEntry[] =
    contract.functionalRequirements.map((requirement) => {
      const taskIds = unique(
        input.productPlan.requirementToTasks[requirement.id] ?? [],
      );
      const files = unique(
        taskIds.flatMap(
          (taskId) => input.productPlan.taskToFiles[taskId] ?? [],
        ),
      );
      const validations = unique(
        taskIds.flatMap(
          (taskId) => input.productPlan.taskToValidation[taskId] ?? [],
        ),
      );
      const prior = previousById.get(requirement.id);
      const mapped = taskIds.length > 0 && files.length > 0;

      return {
        id: requirement.id,
        text: requirement.text,
        priority: requirement.priority,
        category: requirement.category,
        source: "canonical_product_contract",
        sourceField: "functionalRequirements",
        taskIds,
        files,
        tests: prior?.tests ?? [],
        validations,
        implementationHash: prior?.implementationHash ?? null,
        validationEvidence: prior?.validationEvidence ?? [],
        deploymentEvidence: prior?.deploymentEvidence ?? [],
        status: mapped ? (prior?.status ?? "planned") : "blocked",
        unresolvedReason: mapped
          ? prior?.unresolvedReason ?? null
          : "Requirement has no planner task/file mapping.",
      };
    });

  return withUnresolvedState({
    version: 1,
    revision,
    productType: contract.productType,
    selectedTechnologyStack: contract.selectedTechnologyStack,
    originalPrompt: contract.originalPrompt,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    requirements,
    changes: [
      ...(previous?.changes ?? []),
      ...changes.map((change) => ({ ...change, revision })),
    ],
  });
}

export function markRequirementImplementation(
  manifestInput: RequirementManifest,
  files: Record<string, string>,
  now = new Date().toISOString(),
): RequirementManifest {
  const manifest = requirementManifestSchema.parse(manifestInput);
  const requirements = manifest.requirements.map((requirement) => {
    if (requirement.taskIds.length === 0 || requirement.files.length === 0) {
      return {
        ...requirement,
        status: "blocked" as const,
        unresolvedReason: "Requirement has no planner task/file mapping.",
      };
    }

    const existingFiles = requirement.files.filter(
      (path) => typeof files[path] === "string" && files[path].trim().length > 0,
    );
    const evidenceMarker = `requirement: ${requirement.id}`;
    const hasImplementationMarker = existingFiles.some((path) =>
      files[path].includes(evidenceMarker),
    );
    const implemented =
      existingFiles.length === requirement.files.length &&
      hasImplementationMarker;

    if (!implemented) {
      return {
        ...requirement,
        status: "planned" as const,
        implementationHash: null,
        unresolvedReason:
          existingFiles.length !== requirement.files.length
            ? "One or more mapped implementation files are missing."
            : "No requirement-linked implementation evidence marker was found.",
      };
    }

    const implementationHash = createHash("sha256")
      .update(
        requirement.files
          .slice()
          .sort()
          .map((path) => `${path}\0${files[path] ?? ""}\0`)
          .join(""),
      )
      .digest("hex");
    const implementationChanged =
      requirement.implementationHash !== implementationHash;

    return {
      ...requirement,
      implementationHash,
      status:
        !implementationChanged &&
        (requirement.status === "tested" ||
          requirement.status === "validated" ||
          requirement.status === "deployed")
          ? requirement.status
          : ("implemented" as const),
      unresolvedReason: null,
    };
  });

  return withUnresolvedState({
    ...manifest,
    updatedAt: now,
    requirements,
  });
}

export function markRequirementTests(
  manifestInput: RequirementManifest,
  files: Record<string, string>,
  now = new Date().toISOString(),
): RequirementManifest {
  const manifest = requirementManifestSchema.parse(manifestInput);
  const testPaths = Object.keys(files).filter((path) =>
    /(?:^|\/)(?:__tests__\/.*|.*\.(?:test|spec))\.(?:js|jsx|ts|tsx)$/i.test(
      path,
    ),
  );

  const requirements = manifest.requirements.map((requirement) => {
    const marker = `requirement: ${requirement.id}`;
    const tests = unique(
      testPaths.filter((path) => (files[path] ?? "").includes(marker)),
    );

    if (tests.length === 0) {
      return { ...requirement, tests };
    }

    if (
      requirement.status === "implemented" ||
      requirement.status === "tested"
    ) {
      return {
        ...requirement,
        tests,
        status: "tested" as const,
        unresolvedReason: null,
      };
    }

    return { ...requirement, tests };
  });

  return withUnresolvedState({
    ...manifest,
    updatedAt: now,
    requirements,
  });
}

export function markRequirementValidation(
  manifestInput: RequirementManifest,
  validation: ValidationEvidenceInput,
  now = new Date().toISOString(),
): RequirementManifest {
  const manifest = requirementManifestSchema.parse(manifestInput);
  const evidence = {
    stage: validation.stage || "unknown",
    passed: validation.passed,
    at: now,
    errors: unique(validation.errors ?? []).slice(0, 50),
  };

  const requirements = manifest.requirements.map((requirement) => {
    const validationEvidence = [...requirement.validationEvidence, evidence];
    if (!validation.passed) {
      const fallbackStatus =
        requirement.tests.length > 0
          ? ("tested" as const)
          : requirement.implementationHash
            ? ("implemented" as const)
            : requirement.status === "blocked"
              ? ("blocked" as const)
              : ("planned" as const);
      return {
        ...requirement,
        validationEvidence,
        status: fallbackStatus,
        unresolvedReason:
          requirement.priority === "must"
            ? `Validation failed at stage ${evidence.stage}.`
            : requirement.unresolvedReason,
      };
    }

    const implementationPresent =
      requirement.status === "implemented" ||
      requirement.status === "tested" ||
      requirement.status === "validated" ||
      requirement.status === "deployed";

    if (!implementationPresent) {
      return {
        ...requirement,
        validationEvidence,
        status: "blocked" as const,
        unresolvedReason:
          "Validation passed globally but requirement implementation evidence is missing.",
      };
    }

    return {
      ...requirement,
      validationEvidence,
      status:
        requirement.status === "deployed"
          ? ("deployed" as const)
          : ("validated" as const),
      unresolvedReason: null,
    };
  });

  return withUnresolvedState({
    ...manifest,
    updatedAt: now,
    requirements,
  });
}

export function markRequirementDeployment(
  manifestInput: RequirementManifest,
  deployment: DeploymentEvidenceInput,
): RequirementManifest {
  const manifest = requirementManifestSchema.parse(manifestInput);
  const at = deployment.at ?? new Date().toISOString();
  const evidence = {
    destination: deployment.destination,
    url: deployment.url,
    verified: deployment.verified,
    at,
  };

  const requirements = manifest.requirements.map((requirement) => {
    if (requirement.status !== "validated" && requirement.status !== "deployed") {
      return requirement;
    }
    return {
      ...requirement,
      deploymentEvidence: [...requirement.deploymentEvidence, evidence],
      status: deployment.verified ? ("deployed" as const) : requirement.status,
    };
  });

  return withUnresolvedState({
    ...manifest,
    updatedAt: at,
    requirements,
  });
}

export function validateRequirementManifest(
  input: unknown,
): RequirementManifest {
  const manifest = requirementManifestSchema.parse(input);
  const ids = manifest.requirements.map((requirement) => requirement.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Requirement manifest contains duplicate requirement IDs");
  }

  const calculated = unresolvedMustHaveIds(manifest.requirements);
  if (JSON.stringify(calculated) !== JSON.stringify(manifest.unresolvedMustHaveIds)) {
    throw new Error("Requirement manifest unresolved must-have index is stale");
  }
  return manifest;
}

export function assertMustHaveRequirementsResolved(
  input: unknown,
): RequirementManifest {
  const manifest = validateRequirementManifest(input);
  if (manifest.unresolvedMustHaveIds.length > 0) {
    throw new Error(
      `Unresolved must-have requirements block completion: ${manifest.unresolvedMustHaveIds.join(", ")}`,
    );
  }
  return manifest;
}

export function serializeRequirementManifest(
  manifest: RequirementManifest,
): string {
  return JSON.stringify(validateRequirementManifest(manifest), null, 2);
}
