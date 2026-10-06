import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  evaluateFinalProductFactoryFlow,
  FINAL_PRODUCT_FACTORY_STEPS,
} from "../lib/finalProductFactoryFlow.js";
import type { CertificationDecision } from "../lib/certificationLogic.js";
import { resolveStackDependencyGraph } from "../lib/stackDependencyResolver.js";

const certifiedDecision: CertificationDecision = {
  status: "production-certified",
  productionCertified: true,
  productType: "website",
  stack: "react-node",
  verificationMode: "browser",
  monetizationRequired: false,
  authLifecycleRequired: false,
  tenantIsolationRequired: false,
  billingLifecycleRequired: false,
  missingEvidence: [],
  dependencyGraph: resolveStackDependencyGraph("react-node", "website"),
};

describe("#30 Final Product-Factory Flow", () => {
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

  it("fails closed even when certification says certified if the end-to-end flow is incomplete", () => {
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
    expect(report.incompleteSteps).toContain("validated_artifact_deployed");
  });

  it("only declares production-ready when the complete persisted artifact flow is verified", () => {
    const project = JSON.parse(
      readFileSync("src/__tests__/fixtures/final-product-project.json", "utf8"),
    );
    const artifact = JSON.parse(
      readFileSync(
        "src/__tests__/fixtures/final-product-artifact.json",
        "utf8",
      ),
    );

    const report = evaluateFinalProductFactoryFlow({
      project,
      artifact,
      certificationDecision: certifiedDecision,
      deployment: {
        liveUrl: "https://example.test",
        artifactVersion: artifact.version,
        persistedArtifactSha256: artifact.artifactIntegrity.sha256,
        artifactSha256: artifact.artifactIntegrity.sha256,
        httpVerified: true,
        browserVerified: true,
        verification: "browser",
        operationalVerified: true,
      },
      monetizationVerified: true,
      recoveryVerified: true,
    });

    expect(report.productionReady).toBe(true);
    expect(report.incompleteSteps).toEqual([]);
  });

  it("proves the normal worker and self-healing route through the final product-factory flow", () => {
    const worker = readFileSync("src/services/build-worker.ts", "utf8");
    const healing = readFileSync("src/agents/selfHealing.ts", "utf8");

    for (const source of [worker, healing]) {
      expect(source).toContain("evaluateFinalProductFactoryFlow({");
      expect(source).toContain("finalProductFactoryFlow.productionReady");
    }
  });
});
