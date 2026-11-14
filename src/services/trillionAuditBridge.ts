import { createHash } from "node:crypto";
import type { ArtifactIntegrity } from "../lib/artifactIntegrity.js";

export type StaticAuditReceipt = {
  evidenceId: string;
  sourceRevision: string;
  decision: "blocked" | "incomplete" | "static_checks_passed";
  failureControls: string[];
  evidenceDigest: string;
};

/**
 * Optional transport to an independent TrillionAI Audit service.
 * Static analysis is not an independent audit opinion or runtime certification.
 * Any enabled but unavailable service fails closed.
 */
export async function submitToTrillionAudit(input: {
  projectId: number;
  files: Record<string, string>;
  integrity: ArtifactIntegrity;
  fetcher?: typeof fetch;
}): Promise<StaticAuditReceipt | null> {
  const base = process.env.TRILLION_AUDIT_API_URL;
  if (!base) return null;

  const token = process.env.TRILLION_AUDIT_API_TOKEN;
  if (!token) {
    throw new Error(
      "TrillionAI Audit enabled without authenticated service token",
    );
  }
  const url = new URL("/v1/audits/static", base);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  ) {
    throw new Error("TrillionAI Audit service requires HTTPS except loopback");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Audit service URL must not contain credentials or query");
  }
  if (
    input.integrity.projectId !== input.projectId ||
    !/^[a-f0-9]{64}$/.test(input.integrity.sha256)
  ) {
    throw new Error("Invalid artifact identity");
  }
  if (Object.keys(input.files).length > 1000) {
    throw new Error("Audit source file count exceeds limit");
  }
  if (Buffer.byteLength(JSON.stringify(input.files), "utf8") > 4 * 1024 * 1024) {
    throw new Error("Audit source exceeds current engine limit");
  }

  const response = await (input.fetcher ?? fetch)(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      projectName: `project-${input.projectId}`,
      sourceRevision: input.integrity.sha256,
      artifactIntegrity: input.integrity,
      files: input.files,
    }),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`TrillionAI Audit unavailable (HTTP ${response.status})`);
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== "object") {
    throw new Error("Malformed audit response");
  }
  const r = result as Record<string, unknown>;
  const report = r.report as Record<string, unknown> | undefined;
  if (
    r.classification !== "server_computed_static_review" ||
    typeof r.id !== "string" ||
    !/^[0-9a-f-]{36}$/.test(r.id) ||
    r.sourceRevision !== input.integrity.sha256 ||
    !report ||
    !["blocked", "incomplete", "static_checks_passed"].includes(
      String(report.decision),
    ) ||
    !/^[a-f0-9]{64}$/.test(String(report.rootDigest))
  ) {
    throw new Error("Audit response identity or classification invalid");
  }
  if (!Array.isArray(report.evidence) || !Array.isArray(report.findings)) {
    throw new Error("Missing audit evidence");
  }

  // Validate complete file coverage instead of trusting the remote verdict.
  const evidence = report.evidence as Array<{
    path?: unknown;
    sha256?: unknown;
    bytes?: unknown;
  }>;
  const expectedPaths = Object.keys(input.files).sort();
  if (evidence.length !== expectedPaths.length) {
    throw new Error("Audit receipt missing source files");
  }
  const observedPaths = evidence.map((item) => item.path);
  if (
    new Set(observedPaths).size !== expectedPaths.length ||
    expectedPaths.some((path) => !observedPaths.includes(path))
  ) {
    throw new Error("Audit receipt source coverage mismatch");
  }

  for (const item of evidence) {
    if (
      typeof item.path !== "string" ||
      typeof item.sha256 !== "string" ||
      typeof input.files[item.path] !== "string" ||
      item.bytes !== Buffer.byteLength(input.files[item.path]) ||
      item.sha256 !==
        createHash("sha256").update(input.files[item.path]).digest("hex")
    ) {
      throw new Error("Audit receipt does not match the submitted snapshot");
    }
  }

  const canonicalEvidence = evidence
    .map((item) => ({
      path: item.path as string,
      sha256: item.sha256 as string,
      bytes: item.bytes as number,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const expectedDigest = createHash("sha256")
    .update(
      canonicalEvidence
        .map(
          (item) =>
            `${item.path}\0${item.sha256}\0${item.bytes}\n`,
        )
        .join(""),
    )
    .digest("hex");
  if (report.rootDigest !== expectedDigest) {
    throw new Error("Audit evidence root digest mismatch");
  }

  const findings = report.findings as Array<{
    controlId?: unknown;
    status?: unknown;
  }>;
  const failures = findings
    .filter((finding) => finding.status === "fail")
    .map((finding) => String(finding.controlId));
  if (failures.length > 0 || report.decision === "blocked") {
    throw new Error(
      `TrillionAI Audit blocked artifact; failed controls: ${failures.slice(0, 10).join(", ") || "unknown"}`,
    );
  }

  return {
    evidenceId: r.id,
    sourceRevision: input.integrity.sha256,
    decision: report.decision as StaticAuditReceipt["decision"],
    failureControls: [],
    evidenceDigest: report.rootDigest as string,
  };
}
