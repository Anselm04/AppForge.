import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import * as schema from "../db/schema.js";

export type RecoveryCheckpointSource =
  | "validated_artifact"
  | "production_verified";

export type RecoveryFailureKind =
  | "application_failure"
  | "artifact_failure"
  | "database_failure"
  | "migration_failure"
  | "queue_interruption"
  | "build_interrupted"
  | "provider_failure"
  | "deployment_failure"
  | "preview_failure"
  | "credit_refund_failure"
  | "duplicate_build"
  | "partial_generation"
  | "paused_build";

export type RecoveryGuidance = {
  kind: RecoveryFailureKind;
  automatic: boolean;
  action: string;
  preservesKnownGood: boolean;
};

const SHA256 = /^[a-f0-9]{64}$/i;

export function recoveryGuidance(kind: RecoveryFailureKind): RecoveryGuidance {
  const guidance: Record<RecoveryFailureKind, RecoveryGuidance> = {
    application_failure: {
      kind,
      automatic: false,
      action: "restore_latest_known_good",
      preservesKnownGood: true,
    },
    artifact_failure: {
      kind,
      automatic: false,
      action: "reject_corrupt_artifact_and_restore_latest_known_good",
      preservesKnownGood: true,
    },
    database_failure: {
      kind,
      automatic: false,
      action: "restore_verified_database_backup_then_run_invariants",
      preservesKnownGood: true,
    },
    migration_failure: {
      kind,
      automatic: false,
      action: "rollback_when_proven_safe_otherwise_roll_forward_repair",
      preservesKnownGood: true,
    },
    queue_interruption: {
      kind,
      automatic: true,
      action: "resume_durable_queue_or_replay_terminal_event",
      preservesKnownGood: true,
    },
    build_interrupted: {
      kind,
      automatic: true,
      action: "retry_or_resume_without_promoting_partial_generation",
      preservesKnownGood: true,
    },
    provider_failure: {
      kind,
      automatic: false,
      action: "pause_refund_and_retry_after_provider_recovery",
      preservesKnownGood: true,
    },
    deployment_failure: {
      kind,
      automatic: true,
      action: "bounded_retry_then_keep_previous_verified_deployment",
      preservesKnownGood: true,
    },
    preview_failure: {
      kind,
      automatic: false,
      action: "invalidate_preview_and_restore_latest_known_good_if_needed",
      preservesKnownGood: true,
    },
    credit_refund_failure: {
      kind,
      automatic: false,
      action: "reconcile_idempotent_credit_ledger_before_retry",
      preservesKnownGood: true,
    },
    duplicate_build: {
      kind,
      automatic: true,
      action: "reject_duplicate_and_refund_duplicate_reservation_once",
      preservesKnownGood: true,
    },
    partial_generation: {
      kind,
      automatic: true,
      action: "keep_partial_files_non_current_until_validation_completes",
      preservesKnownGood: true,
    },
    paused_build: {
      kind,
      automatic: false,
      action: "resume_from_persisted_contract_after_pause_cause_is_resolved",
      preservesKnownGood: true,
    },
  };
  return guidance[kind];
}

export async function recordKnownGoodCheckpoint(input: {
  projectId: number;
  snapshotId: number;
  artifactVersion: number;
  artifactSha256: string;
  source: RecoveryCheckpointSource;
  deploymentVersion?: number;
  deploymentManifestSha256?: string;
  liveUrl?: string;
}) {
  if (!Number.isInteger(input.artifactVersion) || input.artifactVersion < 1) {
    throw new Error("Recovery checkpoint artifact version must be positive");
  }
  if (!SHA256.test(input.artifactSha256)) {
    throw new Error("Recovery checkpoint artifact SHA-256 is invalid");
  }
  if (
    input.deploymentManifestSha256 &&
    !SHA256.test(input.deploymentManifestSha256)
  ) {
    throw new Error("Recovery checkpoint deployment manifest SHA-256 is invalid");
  }
  if (
    input.source === "production_verified" &&
    (!input.deploymentVersion || !input.liveUrl)
  ) {
    throw new Error(
      "Production recovery checkpoint requires deployment version and live URL",
    );
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${input.projectId})`);
    const snapshot = await tx.query.buildSnapshots.findFirst({
      where: and(
        eq(schema.buildSnapshots.id, input.snapshotId),
        eq(schema.buildSnapshots.projectId, input.projectId),
      ),
    });
    if (!snapshot) throw new Error("Recovery checkpoint snapshot not found");
    if (snapshot.version !== input.artifactVersion) {
      throw new Error("Recovery checkpoint artifact version mismatch");
    }
    const persistedSha = snapshot.artifactIntegrity?.sha256;
    if (!persistedSha || persistedSha !== input.artifactSha256) {
      throw new Error("Recovery checkpoint artifact hash mismatch");
    }

    const existing = await tx.query.recoveryCheckpoints.findFirst({
      where: and(
        eq(schema.recoveryCheckpoints.projectId, input.projectId),
        eq(
          schema.recoveryCheckpoints.artifactVersion,
          input.artifactVersion,
        ),
        eq(schema.recoveryCheckpoints.source, input.source),
      ),
    });

    const values = {
      projectId: input.projectId,
      snapshotId: input.snapshotId,
      artifactVersion: input.artifactVersion,
      artifactSha256: input.artifactSha256,
      deploymentVersion: input.deploymentVersion ?? null,
      deploymentManifestSha256: input.deploymentManifestSha256 ?? null,
      liveUrl: input.liveUrl ?? null,
      source: input.source,
      createdAt: new Date(),
    };

    if (existing) {
      const rows = await tx
        .update(schema.recoveryCheckpoints)
        .set(values)
        .where(eq(schema.recoveryCheckpoints.id, existing.id))
        .returning();
      return rows[0];
    }

    const rows = await tx
      .insert(schema.recoveryCheckpoints)
      .values(values)
      .returning();
    return rows[0];
  });
}

export async function getLatestKnownGoodCheckpoint(
  projectId: number,
  options: { productionOnly?: boolean } = {},
) {
  return db.query.recoveryCheckpoints.findFirst({
    where: options.productionOnly
      ? and(
          eq(schema.recoveryCheckpoints.projectId, projectId),
          eq(schema.recoveryCheckpoints.source, "production_verified"),
        )
      : eq(schema.recoveryCheckpoints.projectId, projectId),
    orderBy: desc(schema.recoveryCheckpoints.createdAt),
  });
}
