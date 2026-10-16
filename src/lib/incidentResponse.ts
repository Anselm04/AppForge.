import { randomBytes } from "node:crypto";
import type { SupportSeverity } from "./customerOperations.js";

export type IncidentStatus =
  | "detected"
  | "triaging"
  | "contained"
  | "recovering"
  | "monitoring"
  | "resolved";

export type Incident = {
  incidentRef: string;
  severity: SupportSeverity;
  status: IncidentStatus;
  summary: string;
  affectedServices: string[];
  customerImpact: string | null;
  evidenceRefs: string[];
  containment: string | null;
  recovery: string | null;
  communications: string[];
  rootCause: string | null;
  correctiveActions: string[];
  regressionEvidence: string[];
  responseStages: string[];
  createdAt: string;
  updatedAt: string;
};

export function severityForImpact(input: {
  customersAffected: "one" | "some" | "many";
  dataRisk: boolean;
  serviceDown: boolean;
}): SupportSeverity {
  if (input.dataRisk && input.customersAffected === "many") return "SEV-1";
  if (input.serviceDown && input.customersAffected === "many") return "SEV-1";
  if (input.dataRisk || input.serviceDown) return "SEV-2";
  if (input.customersAffected === "some") return "SEV-3";
  return "SEV-4";
}

export function createIncident(input: {
  summary: string;
  severity: SupportSeverity;
  affectedServices: string[];
}): Incident {
  const now = new Date().toISOString();
  return {
    incidentRef: `INC-${randomBytes(6).toString("hex").toUpperCase()}`,
    severity: input.severity,
    status: "detected",
    summary: input.summary.trim().slice(0, 4000),
    affectedServices: [
      ...new Set(
        input.affectedServices.map((value) => value.trim()).filter(Boolean),
      ),
    ],
    customerImpact: null,
    evidenceRefs: [],
    containment: null,
    recovery: null,
    communications: [],
    rootCause: null,
    correctiveActions: [],
    regressionEvidence: [],
    responseStages: [
      "detect",
      "triage",
      "contain",
      "communicate",
      "recover",
      "evidence",
      "root-cause",
      "corrective-action",
      "regression-test",
    ],
    createdAt: now,
    updatedAt: now,
  };
}

const SENSITIVE_KEY =
  /(?:password|passphrase|secret|token|authorization|cookie|api[_-]?key|private[_-]?key|email|phone|address)/i;

export function redactOperationalContext(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactOperationalContext);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactOperationalContext(item),
    ]),
  );
}

export const OBSERVABILITY_SURFACES = [
  "application-logs",
  "metrics",
  "traces",
  "errors",
  "builds",
  "providers",
  "queue-depth",
  "job-age",
  "webhooks",
  "billing",
  "authentication",
  "deployments",
] as const;
