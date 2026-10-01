/**
 * Adapter lifecycle management. External technologies change on their own
 * schedule — new stable releases, deprecations, EOL dates, breaking API
 * changes. AppForge must react through the adapter, never by rewriting the
 * core. This module tracks what needs attention and encodes the mandatory
 * migration flow as inspectable data so the step a migration is stuck on is
 * always visible.
 */

import type { TechnologyAdapterDescriptor } from "./adapterSdk.js";

export type LifecycleAlertKind =
  | "eol_passed"
  | "eol_approaching"
  | "deprecated"
  | "quarantined"
  | "stale_verification";

export type LifecycleAlert = {
  adapterId: string;
  kind: LifecycleAlertKind;
  message: string;
};

const EOL_WARNING_WINDOW_DAYS = 90;
/** Adapters claiming "verified" or higher must be re-checked periodically. */
const STALE_VERIFICATION_DAYS = 180;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Computes which adapters need lifecycle attention right now. This never
 * mutates an adapter — it only reports what a human or a follow-up
 * provisioning job should look at.
 */
export function computeLifecycleAlerts(
  adapters: readonly TechnologyAdapterDescriptor[],
  now: Date = new Date(),
): LifecycleAlert[] {
  const alerts: LifecycleAlert[] = [];

  for (const adapter of adapters) {
    if (adapter.eolDate) {
      const eol = new Date(adapter.eolDate);
      if (!Number.isNaN(eol.getTime())) {
        const days = daysBetween(now, eol);
        if (days <= 0) {
          alerts.push({
            adapterId: adapter.id,
            kind: "eol_passed",
            message: `${adapter.label} reached end-of-life on ${adapter.eolDate}. Route builds to the replacement in replacementPath before relying on this adapter.`,
          });
        } else if (days <= EOL_WARNING_WINDOW_DAYS) {
          alerts.push({
            adapterId: adapter.id,
            kind: "eol_approaching",
            message: `${adapter.label} reaches end-of-life in ${days} day(s) (${adapter.eolDate}). Begin migration research now.`,
          });
        }
      }
    }

    if (adapter.lifecycleStatus === "deprecated") {
      alerts.push({
        adapterId: adapter.id,
        kind: "deprecated",
        message:
          adapter.deprecationNotice ??
          `${adapter.label} is marked deprecated. Avoid routing new production builds to it.`,
      });
    }

    if (adapter.quarantine?.quarantined) {
      alerts.push({
        adapterId: adapter.id,
        kind: "quarantined",
        message: `${adapter.label} is quarantined: ${adapter.quarantine.reason ?? "unspecified regression"}.`,
      });
    }

    if (adapter.lastVerifiedAt) {
      const verifiedAt = new Date(adapter.lastVerifiedAt);
      if (
        !Number.isNaN(verifiedAt.getTime()) &&
        daysBetween(verifiedAt, now) > STALE_VERIFICATION_DAYS
      ) {
        alerts.push({
          adapterId: adapter.id,
          kind: "stale_verification",
          message: `${adapter.label} was last verified ${daysBetween(verifiedAt, now)} day(s) ago. Re-run capability tests before trusting its current state.`,
        });
      }
    }
  }

  return alerts;
}

export const MIGRATION_FLOW_STEPS = [
  "detect_change",
  "identify_affected_adapter",
  "research_official_documentation",
  "determine_replacement_or_version",
  "provision_isolated_test_environment",
  "update_or_create_adapter",
  "run_compatibility_tests",
  "run_build_runtime_package_tests",
  "verify_behavior",
  "record_evidence",
  "promote_adapter",
  "migrate_routing_safely",
] as const;

export type MigrationFlowStep = (typeof MIGRATION_FLOW_STEPS)[number];
export type MigrationStepStatus =
  "pending" | "in_progress" | "passed" | "failed";

export type MigrationPlanStep = {
  step: MigrationFlowStep;
  status: MigrationStepStatus;
  notes: string | null;
};

export type AdapterMigrationPlan = {
  adapterId: string;
  fromVersion: string | null;
  candidateVersion: string;
  steps: MigrationPlanStep[];
  outcome: "in_progress" | "promoted" | "rejected";
};

/** Starts a fresh migration plan for moving an adapter to a candidate version. */
export function startAdapterMigration(
  adapter: TechnologyAdapterDescriptor,
  candidateVersion: string,
): AdapterMigrationPlan {
  return {
    adapterId: adapter.id,
    fromVersion: adapter.latestCompatibleStableVersion,
    candidateVersion,
    steps: MIGRATION_FLOW_STEPS.map((step) => ({
      step,
      status: "pending",
      notes: null,
    })),
    outcome: "in_progress",
  };
}

/**
 * Advances one step of a migration plan. If a step fails, the plan is
 * rejected and remaining steps stay pending — the adapter keeps its last
 * verified version and the new one is reported as experimental/degraded,
 * never silently promoted.
 */
export function advanceMigrationStep(
  plan: AdapterMigrationPlan,
  step: MigrationFlowStep,
  status: Exclude<MigrationStepStatus, "pending">,
  notes?: string,
): AdapterMigrationPlan {
  if (plan.outcome !== "in_progress") return plan;
  const steps = plan.steps.map((entry) =>
    entry.step === step
      ? { ...entry, status, notes: notes ?? entry.notes }
      : entry,
  );
  const failed = status === "failed";
  const allPassed =
    !failed && steps.every((entry) => entry.status === "passed");
  return {
    ...plan,
    steps,
    outcome: failed ? "rejected" : allPassed ? "promoted" : "in_progress",
  };
}
