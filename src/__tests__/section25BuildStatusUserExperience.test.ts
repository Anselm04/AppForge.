import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILD_STAGES, isProductionCertified, isProjectArtifactReady, outputMaturityLabel } from "../lib/buildStatus.js";

const source = (path: string) => readFileSync(path, "utf8");

describe("#25 Build Status and User Experience", () => {
  it("defines the complete customer-visible build lifecycle", () => {
    expect(BUILD_STAGES).toEqual(["researching","planning","architecture","generating","persisting","validating","repairing","previewing","browser-verification","deployment","monetization","production-candidate","production-certified"]);
    expect(outputMaturityLabel("structural")).toBe("Structural source");
    expect(outputMaturityLabel("runnable")).toBe("Runnable artifact");
    expect(outputMaturityLabel("verified")).toBe("Verified artifact");
    expect(outputMaturityLabel("certified")).toBe("Production certified");
  });

  it("treats validated output separately from production certification", () => {
    const db = source("src/db.ts");
    const worker = source("src/services/build-worker.ts");
    expect(db).toContain('status: "validated"');
    expect(worker).toContain('await updateProjectStatus(projectId, "production-certified")');
    expect(worker).toContain('"production-candidate"');
    expect(worker.indexOf('source: "production_verified"')).toBeLessThan(worker.indexOf('await updateProjectStatus(projectId, "production-certified")'));
    expect(isProjectArtifactReady("validated")).toBe(true);
    expect(isProductionCertified("validated")).toBe(false);
    expect(isProductionCertified("production-certified")).toBe(true);
  });

  it("records exact stages across the build and deployment path", () => {
    const part1 = source("src/agents/.pipeline_parts/part1.txt");
    const part2 = source("src/agents/.pipeline_parts/part2.txt");
    const part3 = source("src/agents/.pipeline_parts/part3.txt");
    const part4 = source("src/agents/.pipeline_parts/part4.txt");
    const deploy = source("src/services/productionAutoDeploy.ts");
    expect(part1).toContain('updateProjectBuildStage(projectId, "researching"');
    expect(part1).toContain('updateProjectBuildStage(projectId, "planning"');
    expect(part1).toContain('updateProjectBuildStage(projectId, "architecture"');
    expect(part1).toContain('updateProjectBuildStage(projectId, "generating"');
    expect(part1).toContain('updateProjectBuildStage(projectId, "monetization"');
    expect(part2).toContain('updateProjectBuildStage(projectId, "repairing"');
    expect(part3).toContain('updateProjectBuildStage(projectId, "validating"');
    expect(part4).toContain('updateProjectBuildStage(projectId, "persisting"');
    expect(part4).toContain('"production-candidate"');
    expect(deploy).toContain('opts.onStage?.("deployment")');
    expect(deploy).toContain('opts.onStage?.("previewing")');
    expect(deploy).toContain('opts.onStage?.("browser-verification")');
  });

  it("pauses before generation for plan, monetization and integration decisions", () => {
    const pipeline = source("src/agents/.pipeline_parts/part1.txt");
    const router = source("src/routers/projects.ts");
    const approvalGate = pipeline.indexOf('reason: "approval_required"');
    const generating = pipeline.indexOf('updateProjectBuildStage(projectId, "generating"');
    expect(approvalGate).toBeGreaterThan(-1);
    expect(generating).toBeGreaterThan(approvalGate);
    expect(pipeline).toContain("monetizationApprovalRequired");
    expect(pipeline).toContain("integrationApprovalRequired");
    expect(pipeline).toContain('projectRow?.planStatus === "approved"');
    expect(pipeline).toContain("USER PLAN REVISION REQUEST");
    expect(router).toContain("revisePlan: protectedProcedure");
    expect(router).toContain("approvePlan: protectedProcedure");
    expect(router).toContain("approveMonetization: protectedProcedure");
    expect(router).toContain("approveIntegrations: protectedProcedure");
    expect(router).toContain("resumeApprovedBuild: protectedProcedure");
    expect(router).toContain("const promptIntent = project.promptIntent");
    expect(router).toContain("AppForge will not reinterpret the prompt during resume");
  });

  it("never substitutes an AppForge fallback shell for the generated product", () => {
    const finalPipeline = source("src/agents/.pipeline_parts/part4.txt");
    const preview = source("src/routes/livePreview.ts");
    const presentation = source("src/lib/stackPresentation.ts");
    expect(finalPipeline).not.toContain('generatedFiles["_hosted/index.html"]');
    expect(finalPipeline).not.toContain("materializeHostedHtml");
    expect(preview).toContain("AppForge will not substitute a shell or source listing for the real product");
    expect(presentation).toContain("/live/${opts.projectId}");
    expect(presentation).not.toContain("/apps/${opts.projectId}");
  });

  it("shows interpretation, research/plan status, unresolved work and exact failure stage", () => {
    const build = source("src/pages/Build.tsx");
    for (const label of ["Detected product","Selected stack","Build stage","Output","Research","Plan","Unresolved decisions","Incomplete requirements","Failure stage"]) {
      expect(build).toContain(`label="${label}"`);
    }
    expect(build).toContain("Review before generation");
    expect(build).toContain("Request plan revision");
    expect(build).toContain("Approve monetization");
    expect(build).toContain("Approve integrations");
  });

  it("persists Section 25 state and resolved intake intent", () => {
    const schema = source("src/db/schema.ts");
    const migration = source("drizzle/0004_section25_build_status.sql");
    for (const column of ["prompt_intent","build_stage","failure_stage","output_maturity","plan_status","plan_revision_request","monetization_approved","integrations_approved"]) {
      expect(schema + migration).toContain(column);
    }
  });
});
