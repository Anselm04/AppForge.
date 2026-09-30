import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import prettier from "prettier";
import {
  evaluateFinalProductFactoryFlow,
  FINAL_PRODUCT_FACTORY_STEPS,
} from "../lib/finalProductFactoryFlow.js";
import type { CertificationDecision } from "../lib/certificationLogic.js";

const certifiedDecision: CertificationDecision = {
  status: "production-certified",
  productionCertified: true,
  productType: "website",
  stack: "react-node",
  verificationMode: "browser",
  monetizationRequired: false,
  missingEvidence: [],
};

describe("#30 Final Product-Factory Flow", () => {
  it("matches repository Prettier formatting", async () => {
    for (const path of [
      "src/__tests__/section30FinalProductFactoryFlow.test.ts",
      "src/lib/finalProductFactoryFlow.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      const formatted = await prettier.format(source, { parser: "typescript" });
      expect(source, path).toBe(formatted);
    }
  });

  it("defines every required final-flow gate explicitly", () => {
    expect(FINAL_PRODUCT_FACTORY_STEPS).toEqual([
      "contract_validated",
      "ambiguity_resolved",
      "stack_selected",
      "live_research",
      "architecture_defined",
      "implementation_plan_validated",
      "specialist_agents_completed",
      "real_source_files_generated",
      "artifact_persisted",
      "stack_and_requirements_preserved",
      "placeholders_blocked",
      "requirement_linked_evidence",
      "isolated_build_verified",
      "runtime_verified",
      "preview_verified",
      "validated_artifact_deployed",
      "live_product_verified",
      "monetization_and_entitlements_verified",
      "monitoring_verified",
      "recovery_verified",
      "honest_certification",
      "limitations_exposed",
    ]);
  });

  it(
    "fails closed even when certification says certified if the end-to-end flow is incomplete",
    () => {
      const report = evaluateFinalProductFactoryFlow({
        project: {
          description: "Build a website",
          techStack: "react-node",
          productContract: null,
          promptIntent: null,
          researchRecord: null,
          productPlan: null,
          agentCoordination: null,
          requirementManifest: null,
        },
        artifact: null,
        certificationDecision: certifiedDecision,
        deployment: {
          liveUrl: "https://example.test",
          artifactVersion: 1,
          persistedArtifactSha256: "a".repeat(64),
          artifactSha256: "b".repeat(64),
          httpVerified: true,
          browserVerified: true,
          verification: "browser",
          operationalVerified: true,
        },
        monetizationVerified: true,
        recoveryVerified: true,
      });

      expect(report.productionReady).toBe(false);
      expect(report.incompleteSteps).toContain("contract_validated");
      expect(report.incompleteSteps).toContain("live_research");
      expect(report.incompleteSteps).toContain("artifact_persisted");
      expect(report.incompleteSteps).toContain("isolated_build_verified");
      expect(report.limitations.length).toBeGreaterThan(0);
    },
  );

  it(
    "makes the Section 30 verdict authoritative in the final worker handoff",
    () => {
      const worker = readFileSync("src/services/build-worker.ts", "utf8");

      expect(worker).toContain("evaluateFinalProductFactoryFlow");
      expect(worker).toContain("finalProductFactoryFlow.productionReady");
      expect(worker).toContain(
        "limitations: finalProductFactoryFlow.limitations",
      );
      expect(worker).toContain(
        'updateProjectBuildStage(projectId, "production-candidate"',
      );
      expect(worker).not.toContain('updated?.status === "completed"');
    },
  );

  it(
    "exposes the final verdict and unresolved limitations through project evidence",
    () => {
      const db = readFileSync("src/db.ts", "utf8");

      expect(db).toContain("finalProductFactoryFlow");
      expect(db).toContain('source: "final_product_factory_flow"');
      expect(db).toContain("limitations: finalFlowLimitations");
      expect(db).toContain('project.status === "production-certified"');
      expect(db).toContain("?.productionReady === true");
    },
  );

  it("keeps Section 30 in the mandatory product-factory CI gate", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci).toContain(
      "src/__tests__/section30FinalProductFactoryFlow.test.ts",
    );
  });
});
