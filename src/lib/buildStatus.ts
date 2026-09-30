export const BUILD_STAGES = [
  "researching",
  "planning",
  "architecture",
  "generating",
  "persisting",
  "validating",
  "repairing",
  "previewing",
  "browser-verification",
  "deployment",
  "monetization",
  "structured",
  "generated",
  "runnable",
  "behaviorally-verified",
  "deployment-verified",
  "monetization-verified",
  "production-candidate",
  "production-certified",
] as const;

export type BuildStage = (typeof BUILD_STAGES)[number];

export const OUTPUT_MATURITY = [
  "structural",
  "runnable",
  "verified",
  "certified",
] as const;

export type OutputMaturity = (typeof OUTPUT_MATURITY)[number];

export const PLAN_STATUSES = [
  "planning",
  "awaiting_approval",
  "revision_requested",
  "approved",
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export function buildStageLabel(stage: string | null | undefined): string {
  if (!stage) return "Waiting";
  return stage
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function outputMaturityLabel(
  maturity: string | null | undefined,
): string {
  switch (maturity) {
    case "structural":
      return "Structural source";
    case "runnable":
      return "Runnable artifact";
    case "verified":
      return "Verified artifact";
    case "certified":
      return "Production certified";
    default:
      return "Not yet classified";
  }
}

export const READY_PROJECT_STATUSES = [
  "validated",
  "production-certified",
] as const;

export function isProjectArtifactReady(
  status: string | null | undefined,
): boolean {
  return READY_PROJECT_STATUSES.includes(
    status as (typeof READY_PROJECT_STATUSES)[number],
  );
}

export function isProductionCertified(
  status: string | null | undefined,
): boolean {
  return status === "production-certified";
}
