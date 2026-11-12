import { hasExecutedBuildProof } from "./factoryHandoff.js";

/**
 * Evidence-backed, version-locked engineering verification record.
 *
 * A generated file or an AI statement is never itself proof of compilation,
 * browser behaviour, a real provider deployment, or mobile-store submission.
 * Every verdict is derived from durable evidence for the CURRENT artifact.
 */
export type VerificationState = "passed" | "failed" | "unverified";
export type VerificationCheckId =
  | "saved_artifact"
  | "validation"
  | "security"
  | "preview"
  | "production_deployment"
  | "mobile_distribution";

export type VerificationCheck = {
  id: VerificationCheckId;
  state: VerificationState;
  evidenceId: number | null;
  message: string;
};

export type EngineeringVerificationRecord = {
  schemaVersion: 1;
  snapshotId: number | null;
  artifactVersion: number | null;
  artifactSha256: string | null;
  status: "verified" | "incomplete";
  checks: VerificationCheck[];
};

type CurrentSnapshot = {
  id: number;
  version: number;
  fileCount?: number | null;
  artifactIntegrity?: unknown;
  validationResult?: unknown;
};

type Event = {
  id: number;
  kind: string;
  artifactVersion: number | null;
  payload: unknown;
};

type Checkpoint = {
  id?: number;
  source?: string | null;
  snapshotId?: number;
  artifactVersion?: number;
  artifactSha256?: string;
};

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function identity(snapshot: CurrentSnapshot | null): string | null {
  const sha = object(snapshot?.artifactIntegrity).sha256;
  return typeof sha === "string" && /^[0-9a-f]{64}$/i.test(sha)
    ? sha.toLowerCase()
    : null;
}

function eventMatches(
  event: Event,
  snapshot: CurrentSnapshot,
  sha: string,
): boolean {
  const payload = object(event.payload);
  return (
    event.artifactVersion === snapshot.version &&
    payload.snapshotId === snapshot.id &&
    payload.artifactSha256 === sha
  );
}

function latestMatchingEvent(
  events: readonly Event[],
  kind: string,
  snapshot: CurrentSnapshot,
  sha: string,
): Event | undefined {
  return [...events]
    .reverse()
    .find(
      (event) => event.kind === kind && eventMatches(event, snapshot, sha),
    );
}

export function buildEngineeringVerificationRecord(input: {
  currentSnapshot: CurrentSnapshot | null;
  events: readonly Event[];
  checkpoints: readonly Checkpoint[];
  isMobile: boolean;
}): EngineeringVerificationRecord {
  const snapshot = input.currentSnapshot;
  const sha = identity(snapshot);
  const checks: VerificationCheck[] = [];

  const add = (
    id: VerificationCheckId,
    state: VerificationState,
    message: string,
    evidenceId: number | null = null,
  ) => {
    checks.push({ id, state, evidenceId, message });
  };

  if (!snapshot || !sha) {
    for (const id of [
      "saved_artifact",
      "validation",
      "security",
      "preview",
      "production_deployment",
      "mobile_distribution",
    ] as const) {
      add(id, "unverified", "No current content-addressed final artifact.");
    }
    return {
      schemaVersion: 1,
      snapshotId: snapshot?.id ?? null,
      artifactVersion: snapshot?.version ?? null,
      artifactSha256: sha,
      status: "incomplete",
      checks,
    };
  }

  const saved = Number(snapshot.fileCount) > 0;
  add(
    "saved_artifact",
    saved ? "passed" : "unverified",
    saved ? "Final artifact snapshot persisted." : "No files in final artifact.",
    saved ? snapshot.id : null,
  );

  const validator = object(snapshot.validationResult);
  const nativeEvent = latestMatchingEvent(
    input.events,
    "validation",
    snapshot,
    sha,
  );
  const nativeProof = object(nativeEvent?.payload);
  const mobileRuntimeVerified =
    nativeProof.nativeAnalysisPassed === true &&
    nativeProof.nativeBuildPassed === true &&
    nativeProof.backendIntegrationPassed === true;
  // Structural or Python syntax-only checks are useful preliminary evidence,
  // not proof that an application compiled and executed.
  const validationPassed =
    validator.passed === true &&
    hasExecutedBuildProof(validator) &&
    (!input.isMobile || mobileRuntimeVerified);
  const validationFailed = validator.passed === false;
  add(
    "validation",
    validationPassed ? "passed" : validationFailed ? "failed" : "unverified",
    validationPassed
      ? "Artifact validation passed; see original validator evidence for individual executed checks."
      : validationFailed
        ? "Artifact validation failed; inspect recorded validator errors."
        : "No execution-grade validation proof for the current artifact; structural checks do not certify runtime behaviour.",
    validationPassed || validationFailed ? snapshot.id : null,
  );

  const security = latestMatchingEvent(input.events, "security", snapshot, sha);
  const securityPayload = object(security?.payload);
  add(
    "security",
    securityPayload.passed === true
      ? "passed"
      : securityPayload.passed === false
        ? "failed"
        : "unverified",
    securityPayload.passed === true
      ? "Security evidence matches the current artifact."
      : securityPayload.passed === false
        ? "Security checks reported blocking findings."
        : "No passing security evidence matching snapshot ID, version and SHA-256.",
    security?.id ?? null,
  );

  const preview = [...input.events]
    .reverse()
    .find(
      (event) =>
        event.kind === "deployment" &&
        eventMatches(event, snapshot, sha) &&
        object(event.payload).destination === "preview",
    );
  const previewPayload = object(preview?.payload);
  const previewVerified =
    previewPayload.destination === "preview" &&
    previewPayload.previewVerified === true &&
    previewPayload.success === true;
  add(
    "preview",
    previewVerified ? "passed" : "unverified",
    previewVerified
      ? "Preview verification evidence matches the current artifact."
      : "Real preview execution has not been verified for this artifact.",
    previewVerified ? preview?.id ?? null : null,
  );

  const production = input.checkpoints.find(
    (checkpoint) =>
      checkpoint.source === "production_verified" &&
      checkpoint.snapshotId === snapshot.id &&
      checkpoint.artifactVersion === snapshot.version &&
      checkpoint.artifactSha256 === sha,
  );
  add(
    "production_deployment",
    production ? "passed" : "unverified",
    production
      ? "Production verification checkpoint matches this artifact."
      : "No real production deployment checkpoint for this artifact.",
    production?.id ?? null,
  );

  // Store submissions need independent Apple/Google provider evidence.
  // A successful generated Flutter build is NOT an approved store submission.
  add(
    "mobile_distribution",
    "unverified",
    input.isMobile
      ? "Code generation is not app signing, store review or published distribution."
      : "No mobile-store distribution evidence required or asserted.",
  );

  // Deployment and mobile distribution are optional customer actions.
  // The core build may be verified without claiming those actions completed.
  const required: VerificationCheckId[] = [
    "saved_artifact",
    "validation",
    "security",
    "preview",
  ];
  const status = required.every(
    (id) => checks.find((check) => check.id === id)?.state === "passed",
  )
    ? "verified"
    : "incomplete";

  return {
    schemaVersion: 1,
    snapshotId: snapshot.id,
    artifactVersion: snapshot.version,
    artifactSha256: sha,
    status,
    checks,
  };
}
