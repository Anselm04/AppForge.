export const PROJECT_EVIDENCE_KINDS = [
  "intake",
  "research",
  "plan",
  "requirements",
  "artifact_working",
  "validation",
  "repair",
  "security",
  "integration",
  "deployment",
  "monetization",
  "certification",
  "failure",
  "dependency_resolution",
] as const;

export type ProjectEvidenceKind = (typeof PROJECT_EVIDENCE_KINDS)[number];

export type ProjectEvidencePayload = Record<string, unknown>;

export type ProjectEvidenceEvent = {
  id: number;
  projectId: number;
  userId: number;
  kind: ProjectEvidenceKind | string;
  buildStage: string | null;
  attempt: number | null;
  artifactVersion: number | null;
  payload: ProjectEvidencePayload;
  createdAt: Date | null;
};

export function evidencePayload(value: unknown): ProjectEvidencePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value };
  }
  return JSON.parse(JSON.stringify(value)) as ProjectEvidencePayload;
}

export type EvidenceSnapshotIdentity = {
  id: number;
  version: number;
  artifactIntegrity?: { sha256?: string | null } | null;
};

export type ProductionVerificationCheckpoint = {
  source: string | null;
  snapshotId: number;
  artifactVersion: number;
  artifactSha256: string;
};

export function findProductionVerificationForCurrentArtifact(
  checkpoints: readonly ProductionVerificationCheckpoint[],
  currentSnapshot: EvidenceSnapshotIdentity | null | undefined,
): ProductionVerificationCheckpoint | null {
  const currentSha256 = currentSnapshot?.artifactIntegrity?.sha256;
  if (!currentSnapshot || !currentSha256) return null;

  return (
    checkpoints.find(
      (checkpoint) =>
        checkpoint.source === "production_verified" &&
        checkpoint.snapshotId === currentSnapshot.id &&
        checkpoint.artifactVersion === currentSnapshot.version &&
        checkpoint.artifactSha256 === currentSha256,
    ) ?? null
  );
}
