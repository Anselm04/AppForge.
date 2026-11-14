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
 * Optional transport to independent TrillionAI Audit service.
 * This is a REAL static analysis call, not an independent assurance opinion.
 * Any enabled but unresponsive service fails closed, not silently bypassed.
 */
export async function submitToTrillionAudit(input: {
  projectId: number;
  files: Record<string,string>;
  integrity: ArtifactIntegrity;
  fetcher?: typeof fetch;
}): Promise<StaticAuditReceipt | null> {
  const base = process.env.TRILLION_AUDIT_API_URL;
  if (!base) return null; // Not activated until a verified and provisioned service exists.
  const token = process.env.TRILLION_AUDIT_API_TOKEN;
  if (!token) throw new Error("TrillionAI Audit enabled without authenticated service token");
  const url = new URL("/v1/audits/static", base);
  if (url.protocol!=="https:" && !(url.protocol==="http:" && ["localhost","127.0.0.1"].includes(url.hostname)))
    throw new Error("TrillionAI Audit service requires HTTPS except loopback");
  if(url.username||url.password||url.search||url.hash)throw new Error("Audit service URL must not contain credentials or query");
  if(input.integrity.projectId!==input.projectId||!input.integrity.sha256.match(/^[a-f0-9]{64}$/))
    throw new Error("Invalid artifact identity");
  if(Object.keys(input.files).length>1000)throw new Error("Audit source file count exceeds limit");
  if(Buffer.byteLength(JSON.stringify(input.files),"utf8")>4*1024*1024)
    throw new Error("Audit source exceeds current engine limit");
  const response = await (input.fetcher??fetch)(url,{
    method:"POST",
    headers:{"authorization":`Bearer ${token}`,"content-type":"application/json"},
    body:JSON.stringify({
      projectName:`project-${input.projectId}`,
      sourceRevision:input.integrity.sha256,
      artifactIntegrity:input.integrity,
      files:input.files,
    }),
    signal:AbortSignal.timeout(15000),
    redirect:"error",
  });
  if(!response.ok)throw new Error(`TrillionAI Audit unavailable (HTTP ${response.status})`);
  const result:unknown=await response.json();
  if(!result||typeof result!=="object")throw new Error("Malformed audit response");
  const r=result as Record<string,unknown>,report=r.report as Record<string,unknown>|undefined;
  if(r.classification!=="server_computed_static_review"||typeof r.id!=="string"||
    !/^[0-9a-f-]{36}$/.test(r.id)||r.sourceRevision!==input.integrity.sha256||!report||
    !["blocked","incomplete","static_checks_passed"].includes(String(report.decision))||
    !/^[a-f0-9]{64}$/.test(String(report.rootDigest)))
    throw new Error("Audit response identity or classification invalid");
  if(!Array.isArray(report.evidence)||!Array.isArray(report.findings))throw new Error("Missing audit evidence");
  // Independently check coverage and hashes against the exact submitted snapshot.
  // Omission, duplication or arbitrary server digests must never count as proof.
  const evidence = report.evidence as Array<{path?:unknown;sha256?:unknown;bytes?:unknown}>;
  const expectedPaths=Object.keys(input.files).sort();
  if(evidence.length!==expectedPaths.length)throw new Error("Audit receipt missing source files");
  const observedPaths=evidence.map(x=>x.path);
  if(new Set(observedPaths).size!==expectedPaths.length ||
     expectedPaths.some(p=>!observedPaths.includes(p)))
    throw new Error("Audit receipt source coverage mismatch");
  for(const file of evidence) {
    if(typeof file.path!=="string"||typeof file.sha256!=="string"||
      typeof input.files[file.path]!=="string"||file.bytes!==Buffer.byteLength(input.files[file.path])||
      file.sha256!==createHash("sha256").update(input.files[file.path]).digest("hex"))
      throw new Error("Audit receipt does not match the submitted snapshot");
  }
  const canonicalEvidence=evidence.map(file=>({
    path:file.path as string,sha256:file.sha256 as string,bytes:file.bytes as number
  })).sort((a,b)=>a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const expectedDigest=createHash("sha256").update(canonicalEvidence.map(e=>
    `${e.path}\\0${e.sha256}\\0${e.bytes}\\n`).join("")).digest("hex");
  if(report.rootDigest!==expectedDigest)throw new Error("Audit evidence root digest mismatch");
  const findings=report.findings as Array<{controlId?:unknown;status?:unknown}>;
  const failures=findings.filter(f=>f.status==="fail").map(f=>String(f.controlId));
  if(failures.length>0||report.decision==="blocked")
    throw new Error(`TrillionAI Audit blocked artifact; failed controls: ${failures.slice(0,10).join(", ")||"unknown"}`);
  return {
    evidenceId:r.id,sourceRevision:input.integrity.sha256,
    decision:report.decision as StaticAuditReceipt["decision"],
    failureControls:[],
    evidenceDigest:report.rootDigest as string
  };
}
