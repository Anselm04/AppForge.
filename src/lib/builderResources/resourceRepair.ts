import type { BuilderResourceManifest } from "./resourceManifest.js";
import { quarantineBuilderResource } from "./resourceGovernance.js";

export type ResourceFailureKind =
  | "resource-defect"
  | "resource-version-incompatibility"
  | "adaptation-defect"
  | "integration-conflict"
  | "missing-dependency"
  | "platform-mismatch"
  | "custom-code-defect";

export type ResourceFailureSignal = {
  resourceId?: string;
  message: string;
  conflictKind?: string;
  missingDependency?: string;
  targetPlatform?: string;
  adaptationPath?: string;
  customFile?: string;
};

export type ResourceRepairDecision = {
  kind: ResourceFailureKind;
  repairScope:
    | "resource"
    | "resource-version"
    | "adaptation"
    | "composition"
    | "dependency"
    | "platform-plan"
    | "custom-code";
  rationale: string;
  quarantineResource: boolean;
};

export function diagnoseBuilderResourceFailure(
  signal: ResourceFailureSignal,
): ResourceRepairDecision {
  const message = signal.message.toLowerCase();

  if (
    signal.missingDependency ||
    /missing (?:dependency|package|module)/i.test(message)
  ) {
    return {
      kind: "missing-dependency",
      repairScope: "dependency",
      rationale: signal.missingDependency
        ? `Missing dependency ${signal.missingDependency}`
        : signal.message,
      quarantineResource: false,
    };
  }
  if (
    signal.conflictKind ||
    /conflict|duplicate route|version collision/i.test(message)
  ) {
    return {
      kind: "integration-conflict",
      repairScope: "composition",
      rationale: signal.conflictKind ?? signal.message,
      quarantineResource: false,
    };
  }
  if (signal.adaptationPath || /adapt(?:ation|ed).*fail/i.test(message)) {
    return {
      kind: "adaptation-defect",
      repairScope: "adaptation",
      rationale: signal.adaptationPath ?? signal.message,
      quarantineResource: false,
    };
  }
  if (
    signal.targetPlatform ||
    /platform.*(?:unsupported|mismatch|unavailable)/i.test(message)
  ) {
    return {
      kind: "platform-mismatch",
      repairScope: "platform-plan",
      rationale: signal.targetPlatform ?? signal.message,
      quarantineResource: false,
    };
  }
  if (
    /version.*(?:incompatible|unsupported|mismatch)|peer dependency/i.test(
      message,
    )
  ) {
    return {
      kind: "resource-version-incompatibility",
      repairScope: "resource-version",
      rationale: signal.message,
      quarantineResource: false,
    };
  }
  if (
    signal.customFile ||
    /generated custom|customer-specific|custom code/i.test(message)
  ) {
    return {
      kind: "custom-code-defect",
      repairScope: "custom-code",
      rationale: signal.customFile ?? signal.message,
      quarantineResource: false,
    };
  }

  return {
    kind: "resource-defect",
    repairScope: "resource",
    rationale: signal.message,
    quarantineResource: true,
  };
}

export function applyResourceFailureDecision(
  resource: BuilderResourceManifest,
  decision: ResourceRepairDecision,
): BuilderResourceManifest {
  if (!decision.quarantineResource) return resource;
  return quarantineBuilderResource(resource, decision.rationale);
}
