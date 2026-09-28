import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("#25 Build Status and User Experience", () => {
  it("defines every required durable build stage and output maturity", () => {
    const status = source("src/lib/buildStatus.ts");
    for (const stage of [
      "researching",
      "planning",
      "architecture",
      "generating",
      "persisting",
      "validating",
      "repairing",
      "previewing",
      "browser-verification",
      "deployment",
      "monetization",
      "production-candidate",
      "production-certified",
    ]) {
      expect(status).toContain(`"${stage}"`);
    }
    for (const maturity of [
      "structural",
      "runnable",
      "verified",
      "certified",
    ]) {
      expect(status).toContain(`"${maturity}"`);
    }
  });

  it("persists lifecycle, failure, maturity and approval state", () => {
    const schema = source("src/db/schema.ts");
    const migration = source("drizzle/0004_section25_build_status.sql");
    for (const field of [
      "buildStage",
      "failureStage",
      "outputMaturity",
      "planStatus",
      "planRevisionRequest",
      "monetizationApproved",
      "integrationsApproved",
    ]) {
      expect(schema).toContain(field);
    }
    for (const column of [
      "build_stage",
      "failure_stage",
      "output_maturity",
      "plan_status",
      "plan_revision_request",
      "monetization_approved",
      "integrations_approved",
    ]) {
      expect(migration).toContain(`"${column}"`);
    }
  });

  it("does not mark compile-only snapshot persistence completed", () => {
    const db = source("src/db.ts");
    const finalSnapshot = db.slice(
      db.indexOf("export async function createAndActivateBuildSnapshot"),
      db.indexOf("export async function getSnapshotsByProject"),
    );
    expect(finalSnapshot).toContain('status: "validated"');
    expect(finalSnapshot).not.toContain('status: "completed"');
  });

  it("certifies production only after verified deployment and preserves candidates otherwise", () => {
    const worker = source("src/services/build-worker.ts");
    const deploy = worker.indexOf("await deployValidatedProjectWithRetry({");
    const checkpoint = worker.indexOf('source: "production_verified"');
    const certified = worker.indexOf(
      'await updateProjectStatus(projectId, "production-certified")',
    );
    expect(deploy).toBeGreaterThan(-1);
    expect(checkpoint).toBeGreaterThan(deploy);
    expect(certified).toBeGreaterThan(checkpoint);
    expect(worker).toContain(
      'await updateProjectBuildStage(projectId, "production-certified"',
    );
    expect(worker).toContain(
      'await updateProjectBuildStage(projectId, "production-candidate"',
    );
  });

  it("holds generation for plan, monetization and integration approval", () => {
    const pipeline = source("src/agents/.pipeline_parts/part1.txt");
    const architecture = pipeline.indexOf(
      'await updateProjectBuildStage(projectId, "architecture")',
    );
    const approval = pipeline.indexOf('reason: "approval_required"');
    const generating = pipeline.indexOf(
      'await updateProjectBuildStage(projectId, "generating")',
    );
    const coder = pipeline.indexOf('emit("Coder", "start"');
    expect(architecture).toBeGreaterThan(-1);
    expect(approval).toBeGreaterThan(architecture);
    expect(generating).toBeGreaterThan(approval);
    expect(coder).toBeGreaterThan(generating);
    expect(pipeline).toContain("monetizationApprovalRequired");
    expect(pipeline).toContain("integrationApprovalRequired");
  });

  it("supports revising and approving the plan before generation resumes", () => {
    const router = source("src/routers/projects.ts");
    expect(router).toContain("revisePlan: protectedProcedure");
    expect(router).toContain("approvePlan: protectedProcedure");
    expect(router).toContain("approveMonetization: protectedProcedure");
    expect(router).toContain("approveIntegrations: protectedProcedure");
    expect(router).toContain("resumeApprovedBuild: protectedProcedure");
    expect(router).toContain("contract.originalPrompt");
    expect(router).toContain("contract.selectedTechnologyStack");
    expect(router).toContain("const promptIntent = project.promptIntent");
    expect(router).toContain(
      "AppForge will not reinterpret the prompt during resume",
    );
    expect(router).toContain("project.creditsReserved");
    expect(router).toContain(
      'const revisingPlan = project.planStatus === "revision_requested"',
    );
    expect(router).toContain("planRevisionRequest: null");
    expect(router).toContain(
      "The requested plan revision must be regenerated before this plan can be approved.",
    );
  });

  it("never substitutes an AppForge shell route for the generated live product", () => {
    const presentation = source("src/lib/stackPresentation.ts");
    const finalPipeline = source("src/agents/.pipeline_parts/part4.txt");
    const preview = source("src/routes/livePreview.ts");
    const helper = presentation.slice(
      presentation.indexOf("export function completedBuildUrl"),
    );
    expect(helper).not.toContain("/apps/");
    expect(helper).toContain("if (opts.liveUrl) return opts.liveUrl");
    expect(helper).toContain("return null");
    expect(finalPipeline).not.toContain('generatedFiles["_hosted/index.html"]');
    expect(finalPipeline).not.toContain("materializeHostedHtml");
    expect(preview).toContain(
      "AppForge will not substitute a shell or source listing for the real product",
    );
  });

  it("shows the customer the exact stage, maturity and unresolved decisions", () => {
    const build = source("src/pages/Build.tsx");
    expect(build).toContain('data-testid="build-status-panel"');
    expect(build).toContain('label="Detected product"');
    expect(build).toContain('label="Selected stack"');
    expect(build).toContain('label="Research"');
    expect(build).toContain('label="Plan"');
    expect(build).toContain('label="Unresolved decisions"');
    expect(build).toContain('label="Incomplete requirements"');
    expect(build).toContain('label="Failure stage"');
    expect(build).toContain("outputMaturityLabel(project.outputMaturity)");
    expect(build).toContain('data-testid="build-approval-panel"');
    expect(build).toContain("Review validated plan");
    expect(build).toContain("Request plan revision");
    expect(build).toContain("Resume generation");
    expect(build).toContain("Regenerate revised plan");
  });

  it("reuses the exact approved plan unless the user requested a revision", () => {
    const pipeline = source("src/agents/.pipeline_parts/part1.txt");
    expect(pipeline).toContain('projectRow?.planStatus === "approved"');
    expect(pipeline).toContain("!projectRow.planRevisionRequest");
    expect(pipeline).toContain(
      "validateProductPlan(projectRow.productPlan, productContract)",
    );
    expect(pipeline).toContain("no silent re-planning is allowed");
  });

  it("records failure stage from the active build stage", () => {
    const db = source("src/db.ts");
    expect(db).toContain(
      'status === "failed" ? sql`${schema.projects.buildStage}` : undefined',
    );
  });

  it("keeps manual deployments as validated candidates instead of false certification", () => {
    const router = source("src/routers/projects.ts");
    const deploy = router.slice(
      router.indexOf("deploy: protectedProcedure"),
      router.indexOf("download: protectedProcedure"),
    );
    expect(deploy).toContain('status: "validated"');
    expect(deploy).toContain('"production-candidate"');
    expect(deploy).not.toContain('status: "completed"');
    expect(deploy).not.toContain('status: "production-certified"');
  });
});
