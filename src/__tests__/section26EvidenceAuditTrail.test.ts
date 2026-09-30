import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Section 26 evidence and audit trail", () => {
  it("persists append-only project evidence with ownership and artifact identity", () => {
    const schema = source("src/db/schema.ts");
    const migration = source("drizzle/0005_section26_evidence_audit_trail.sql");
    const hardening = source(
      "drizzle/0006_section26_evidence_integrity_hardening.sql",
    );
    const ensureSchema = source("src/db/ensureSchema.ts");
    const db = source("src/db.ts");

    for (const marker of [
      "export const projectEvidence = pgTable(",
      '"project_evidence"',
      'kind: varchar("kind"',
      'buildStage: varchar("build_stage"',
      'attempt: integer("attempt")',
      'artifactVersion: integer("artifact_version")',
      'payload: jsonb("payload").notNull()',
    ]) {
      expect(schema).toContain(marker);
    }

    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS "project_evidence"',
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "project_evidence_project_id_idx"',
    );
    expect(db).toContain("export async function recordProjectEvidence");
    expect(db).toContain(".insert(schema.projectEvidence)");
    expect(db).not.toContain(".update(schema.projectEvidence)");
    expect(db).not.toContain(".delete(schema.projectEvidence)");
    expect(hardening).toContain('"project_evidence_append_only"');
    expect(hardening).toContain("BEFORE UPDATE OR DELETE");
    expect(hardening).toContain("pg_trigger_depth() > 1");
    expect(ensureSchema).toContain("SECTION26_EVIDENCE_INTEGRITY_SQL");
    expect(ensureSchema).toContain('"20260930_006"');
  });

  it("persists original prompt, product contract and selected stack at intake", () => {
    const db = source("src/db.ts");

    expect(db).toContain('kind: "intake"');
    expect(db).toContain(
      "originalPrompt: productContract?.originalPrompt ?? data.description",
    );
    expect(db).toContain("productContract: productContract ?? null");
    expect(db).toContain("selectedStack: data.techStack");
    expect(db).toContain("promptIntent: data.promptIntent ?? null");
  });

  it("persists research queries, sources and decisions", () => {
    const research = source("src/agents/researchAgent.ts");

    expect(research).toContain('kind: "research"');
    expect(research).toContain("queries: researchRecord.queries");
    expect(research).toContain("sources: researchRecord.sources");
    expect(research).toContain("decisions: researchRecord.decisions");
    expect(research).toContain("conflicts: researchRecord.conflicts");
    expect(research).toContain("uncertainty: researchRecord.uncertainty");
  });

  it("persists architecture, implementation tasks and requirement manifest", () => {
    const pipeline = source("src/agents/.pipeline_parts/part1.txt");

    expect(pipeline).toContain('kind: "plan"');
    expect(pipeline).toContain("architecture: productPlan.architecture");
    expect(pipeline).toContain("implementationTasks: productPlan.tasks");
    expect(pipeline).toContain("implementationSequence");
    expect(pipeline).toContain('kind: "requirements"');
    expect(pipeline).toContain("requirementManifest");
    expect(pipeline).toContain("unresolvedMustHaveIds");
  });

  it("persists generated files through versioned artifacts and exact hashes", () => {
    const db = source("src/db.ts");
    const pipeline = source("src/agents/.pipeline_parts/part4.txt");

    expect(db).toContain("workingArtifactVersion");
    expect(db).toContain("workingArtifactIntegrity");
    expect(db).toContain("files: project.generatedFiles ?? {}");
    expect(db).toContain("snapshots: snapshots.map");
    expect(db).toContain("files: snapshot.files");
    expect(db).toContain("artifactIntegrity: snapshot.artifactIntegrity");
    expect(pipeline).toContain('kind: "artifact_working"');
    expect(pipeline).toContain("snapshotId");
    expect(pipeline).toContain(
      "artifactIntegrity: finalizedSnapshot.integrity",
    );
  });

  it("persists validation, repair and security results for every attempt", () => {
    const validation = source("src/agents/.pipeline_parts/part3.txt");
    const repair = source("src/agents/.pipeline_parts/part2.txt");
    const deploy = source("src/services/productionAutoDeploy.ts");

    expect(validation).toContain('kind: "validation"');
    expect(validation).toContain("repairAttempt: fixAttempt");
    expect(validation).toContain("validationResult");
    expect(validation).toContain('kind: "security"');
    expect(validation).toContain("security: lastAuditResult?.security");
    expect(repair).toContain('kind: "repair"');
    expect(repair).toContain("errorsBeforeRepair");
    expect(repair).toContain("patchedFiles");
    expect(repair).toContain("artifactIntegrity: repairArtifact");
    expect(deploy).toContain('phase: "pre_deploy"');
    expect(deploy).toContain("blockingFindings");
  });

  it("persists integration, monetization and deployment results", () => {
    const projects = source("src/routers/projects.ts");
    const worker = source("src/services/build-worker.ts");
    const production = source("src/services/productionAutoDeploy.ts");

    expect(projects).toContain('kind: "monetization"');
    expect(projects).toContain(
      "requirements: contract.monetizationRequirements",
    );
    expect(projects).toContain('kind: "integration"');
    expect(projects).toContain("integrations: contract.integrations");
    expect(projects).toContain('kind: "deployment"');
    expect(projects).toContain("smokeTest: smoke");
    expect(worker).toContain("retryable: attempt < DEPLOY_MAX_ATTEMPTS");
    expect(production).toContain(
      'payload: { success: true, destination: "fly", ...certification }',
    );
  });

  it("persists unresolved risks and certification status", () => {
    const db = source("src/db.ts");
    const worker = source("src/services/build-worker.ts");

    expect(db).toContain("const unresolvedRisks = [");
    expect(db).toContain('source: "requirement"');
    expect(db).toContain('source: "validation"');
    expect(db).toContain("certification: {");
    expect(db).toContain("currentArtifactSha256");
    expect(db).toContain("findProductionVerificationForCurrentArtifact");
    expect(db).toContain(
      "productionVerified: productionVerificationCheckpoint !== null",
    );
    expect(db).toContain("productionVerificationCheckpoint,");
    expect(db).toContain("(currentSnapshot?.validationResult as any)?.errors");
    expect(db).toContain("(currentSnapshot?.auditScores as any)?.findings");
    expect(db).not.toContain(
      "(latestSnapshot?.validationResult as any)?.errors",
    );
    expect(worker).toContain('kind: "certification"');
    expect(worker).toContain("...certificationDecision");
    expect(worker).toContain("finalProductFactoryFlow.productionReady");
    expect(worker).toContain("certificationDecision.status");
    expect(worker).toContain("limitations: finalProductFactoryFlow.limitations");
  });

  it("makes the evidence visible to project users and owner administrators", () => {
    const projects = source("src/routers/projects.ts");
    const adminRouter = source("src/routers/admin.ts");
    const build = source("src/pages/Build.tsx");
    const admin = source("src/pages/Admin.tsx");

    expect(projects).toContain("evidence: protectedProcedure");
    expect(projects).toContain("getProjectEvidenceBundle(input.id)");
    expect(projects).toContain("project.userId !== ctx.user.id");
    expect(adminRouter).toContain("projectEvidence: ownerOnlyProcedure");
    expect(adminRouter).toContain("getProjectEvidenceBundle(input.projectId)");
    expect(build).toContain('data-testid="project-evidence-panel"');
    expect(build).toContain("Evidence & audit trail");
    expect(build).toContain("Versioned generated files");
    expect(admin).toContain("Project evidence & audit trail");
    expect(admin).toContain("Full canonical evidence");
  });

  it("preserves evidence across retries, repairs and self-healing redeployments", () => {
    const db = source("src/db.ts");
    const worker = source("src/services/build-worker.ts");
    const healing = source("src/agents/selfHealing.ts");

    expect(db).toContain(".insert(schema.projectEvidence)");
    expect(worker).toContain("attempt,");
    expect(worker).toContain('kind: "deployment"');
    expect(healing).toContain('source: "self_healing"');
    expect(healing).toContain('kind: "repair"');
    expect(healing).toContain('kind: "certification"');
    expect(healing).toContain(
      "artifactSha256: persistedArtifact.integrity.sha256",
    );
  });
});
