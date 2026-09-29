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
