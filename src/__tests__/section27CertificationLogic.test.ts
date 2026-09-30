import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CERTIFICATION_STATUSES,
  assertProductionCertified,
  evaluateCertification,
  hasVerifiedMonetizationEvidence,
  requirementBehaviorVerified,
} from "../lib/certificationLogic.js";
import type { ProductContract } from "../lib/productContract.js";

function contract(overrides: Partial<ProductContract> = {}): ProductContract {
  return {
    version: 2,
    originalPrompt: "Build a production API",
    productType: "api",
    productFamilies: ["backend", "deployment"],
    targetUsers: ["customers"],
    userRoles: ["user"],
    coreWorkflows: ["Use API"],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: "Core API works",
        category: "workflow",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: ["Reliable"],
    dataModels: [],
    integrations: [],
    securityRequirements: ["No exposed secrets"],
    deploymentRequirements: ["Verified deployment"],
    monetizationRequirements: [],
    selectedTechnologyStack: "api-service",
    researchRequirements: [],
    runtimeRequirements: ["Healthy runtime"],
    secondaryCapabilities: ["deployment"],
    intentConfidence: 1,
    canonicalInterpretation: "Production API",
    contractDerivation: "prompt_deterministic",
    ...overrides,
  };
}

function evidence(overrides = {}) {
  return {
    artifactPresent: true,
    generatedFileCount: 12,
    requirementsResolved: true,
    behavioralTestsVerified: true,
    runtimeVerified: true,
    securityVerified: true,
    deploymentVerified: true,
    healthVerified: true,
    operationalVerified: true,
    recoveryVerified: true,
    monetizationVerified: false,
    ...overrides,
  };
}

describe("Section 27 certification logic", () => {
  it("defines the complete certification ladder", () => {
    expect(CERTIFICATION_STATUSES).toEqual([
      "structured",
      "generated",
      "runnable",
      "behaviorally-verified",
      "deployment-verified",
      "monetization-verified",
      "production-candidate",
      "production-certified",
    ]);
  });

  it("certifies a non-monetized service only with complete evidence", () => {
    const decision = evaluateCertification({
      productContract: contract(),
      evidence: evidence(),
    });
    expect(decision.productionCertified).toBe(true);
    expect(decision.status).toBe("production-certified");
    expect(decision.verificationMode).toBe("health");
    expect(decision.missingEvidence).toEqual([]);
  });

  it("fails closed when required evidence is missing", () => {
    const decision = evaluateCertification({
      productContract: contract(),
      evidence: evidence({
        securityVerified: false,
        recoveryVerified: false,
      }),
    });
    expect(decision.productionCertified).toBe(false);
    expect(decision.status).toBe("production-candidate");
    expect(decision.missingEvidence).toEqual(
      expect.arrayContaining(["security", "recovery"]),
    );
    expect(() => assertProductionCertified(decision)).toThrow(
      /security|recovery/,
    );
  });

  it("never production-certifies structural or compile-only stacks", () => {
    const decision = evaluateCertification({
      productContract: contract({
        productType: "ai_agent",
        productFamilies: ["ai", "backend"],
        selectedTechnologyStack: "ai-agent-python",
      }),
      evidence: evidence(),
    });
    expect(decision.productionCertified).toBe(false);
    expect(decision.status).toBe("generated");
    expect(decision.verificationMode).toBe("native");
    expect(decision.missingEvidence).toEqual(
      expect.arrayContaining(["runtime", "deployment"]),
    );
  });

  it("requires real browser verification for browser product types", () => {
    const decision = evaluateCertification({
      productContract: contract({
        productType: "website",
        productFamilies: ["frontend", "deployment"],
        selectedTechnologyStack: "static-html",
      }),
      evidence: evidence({
        browserVerified: false,
        healthVerified: undefined,
      }),
    });
    expect(decision.productionCertified).toBe(false);
    expect(decision.missingEvidence).toContain("browser");
  });

  it("never calls requested monetization live without verified evidence", () => {
    const monetized = contract({
      productType: "saas_application",
      productFamilies: ["frontend", "backend", "billing", "deployment"],
      selectedTechnologyStack: "next-node",
      secondaryCapabilities: ["billing", "deployment"],
      monetizationRequirements: ["Stripe subscription billing"],
    });

    const unverified = evaluateCertification({
      productContract: monetized,
      evidence: evidence({
        browserVerified: true,
        healthVerified: undefined,
        monetizationVerified: false,
      }),
    });
    expect(unverified.productionCertified).toBe(false);
    expect(unverified.status).toBe("production-candidate");
    expect(unverified.missingEvidence).toContain("monetization");

    const verified = evaluateCertification({
      productContract: monetized,
      evidence: evidence({
        browserVerified: true,
        healthVerified: undefined,
        monetizationVerified: true,
      }),
    });
    expect(verified.productionCertified).toBe(true);
  });

  it("requires linked passing behavioral evidence for must-have requirements", () => {
    expect(
      requirementBehaviorVerified({
        unresolvedMustHaveIds: [],
        requirements: [
          {
            priority: "must",
            status: "validated",
            tests: ["test/core.test.ts"],
            validationEvidence: [{ passed: true }],
          },
        ],
      }),
    ).toBe(true);

    expect(
      requirementBehaviorVerified({
        unresolvedMustHaveIds: [],
        requirements: [
          {
            priority: "must",
            status: "validated",
            tests: [],
            validationEvidence: [{ passed: true }],
          },
        ],
      }),
    ).toBe(false);
  });

  it("accepts monetization verification only for the same artifact version", () => {
    const events = [
      {
        kind: "monetization",
        artifactVersion: 4,
        payload: { verified: true },
      },
    ];
    expect(hasVerifiedMonetizationEvidence(events, 4)).toBe(true);
    expect(hasVerifiedMonetizationEvidence(events, 5)).toBe(false);
  });
  it("wires the certification engine into normal builds and self-healing", () => {
    const worker = readFileSync("src/services/build-worker.ts", "utf8");
    const healing = readFileSync("src/agents/selfHealing.ts", "utf8");
    const pipeline = readFileSync("src/agents/.pipeline_parts/part4.txt", "utf8");

    expect(worker).toContain("evaluateCertification({");
    expect(worker).toContain("verifiedMonetizationEvidence");
    expect(worker).toContain("certificationDecision.productionCertified");
    expect(healing).toContain("evaluateCertification({");
    expect(healing).toContain("recordKnownGoodCheckpoint({");
    expect(healing).toContain("hasVerifiedMonetizationEvidence");
    expect(pipeline).toContain('"behaviorally-verified"');
    expect(pipeline).toContain('"generated"');
    expect(pipeline).not.toContain(
      'updateProjectBuildStage(projectId, "production-candidate"',
    );
  });

});
