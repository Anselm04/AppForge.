import {describe,it,expect,vi,afterEach} from "vitest";
import {submitToTrillionAudit} from "../services/trillionAuditBridge.js";
import {buildArtifactIntegrity} from "../lib/artifactIntegrity.js";
import {createHash} from "node:crypto";
afterEach(()=>{delete process.env.TRILLION_AUDIT_API_URL;delete process.env.TRILLION_AUDIT_API_TOKEN;});
const files={"package.json":'{"name":"sample"}'};
const integrity=buildArtifactIntegrity({projectId:7,artifactVersion:1,state:"final",files});
const digest=createHash("sha256").update(files["package.json"]).digest("hex");
const receipt=(decision:"incomplete"|"blocked"="incomplete")=>({
  id:"123e4567-e89b-12d3-a456-426614174000",
  classification:"server_computed_static_review",
  sourceRevision:integrity.sha256,
  report:{decision,rootDigest:"a".repeat(64),evidence:[{path:"package.json",sha256:digest,bytes:Buffer.byteLength(files["package.json"])}],findings:[{controlId:"TVBS-06",status:"not_assessed"}]}
});
describe("TrillionAI Audit bridge",()=>{
 it("does not activate a paid or external dependency by default",async()=>{
  expect(await submitToTrillionAudit({projectId:7,files,integrity})).toBeNull();
 });
 it("preserves unassessed state instead of inventing a verified audit",async()=>{
  process.env.TRILLION_AUDIT_API_URL="http://127.0.0.1:8788";
  process.env.TRILLION_AUDIT_API_TOKEN="test";
  const fetcher=vi.fn(async()=>new Response(JSON.stringify(receipt()),{status:201})) as unknown as typeof fetch;
  const result=await submitToTrillionAudit({projectId:7,files,integrity,fetcher});
  expect(result?.decision).toBe("incomplete");
 });
 it("rejects tampered evidence and blocked results",async()=>{
  process.env.TRILLION_AUDIT_API_URL="http://127.0.0.1:8788";
  process.env.TRILLION_AUDIT_API_TOKEN="test";
  const bad=receipt();bad.report.evidence[0].sha256="0".repeat(64);
  const fetcher=vi.fn(async()=>new Response(JSON.stringify(bad),{status:201})) as unknown as typeof fetch;
  await expect(submitToTrillionAudit({projectId:7,files,integrity,fetcher})).rejects.toThrow("does not match");
  const blocked=vi.fn(async()=>new Response(JSON.stringify(receipt("blocked")),{status:201})) as unknown as typeof fetch;
  await expect(submitToTrillionAudit({projectId:7,files,integrity,fetcher:blocked})).rejects.toThrow("blocked");
 });
});
