import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CERTIFICATION_STATUSES,
  assertProductionCertified,
  evaluateCertification,
  hasVerifiedArtifactEvidence,
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
    expect(decision.status).toBe("deployment-verified");
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

  it("requires generated-app auth lifecycle evidence when authentication is requested", () => {
    const authApp = contract({
      secondaryCapabilities: ["authentication", "deployment"],
      productFamilies: ["backend", "auth", "deployment"],
    });

    const unverified = evaluateCertification({
      productContract: authApp,
      evidence: evidence({ authLifecycleVerified: false }),
    });
    expect(unverified.productionCertified).toBe(false);
    expect(unverified.authLifecycleRequired).toBe(true);
    expect(unverified.missingEvidence).toContain("auth_lifecycle");

    const verified = evaluateCertification({
      productContract: authApp,
      evidence: evidence({ authLifecycleVerified: true }),
    });
    expect(verified.productionCertified).toBe(true);
  });

  it("requires cross-tenant isolation evidence for every generated SaaS product", () => {
    const saas = contract({
      productType: "saas_application",
      productFamilies: ["frontend", "backend", "database", "deployment"],
      selectedTechnologyStack: "next-node",
      secondaryCapabilities: ["database", "deployment"],
    });

    const unverified = evaluateCertification({
      productContract: saas,
      evidence: evidence({
        browserVerified: true,
        healthVerified: undefined,
        tenantIsolationVerified: false,
      }),
    });
    expect(unverified.productionCertified).toBe(false);
    expect(unverified.tenantIsolationRequired).toBe(true);
    expect(unverified.missingEvidence).toContain("tenant_isolation");

    const verified = evaluateCertification({
      productContract: saas,
      evidence: evidence({
        browserVerified: true,
        healthVerified: undefined,
        tenantIsolationVerified: true,
      }),
    });
    expect(verified.productionCertified).toBe(true);
  });

  it("requires full generated billing lifecycle evidence in addition to monetization health", () => {
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
        tenantIsolationVerified: true,
        monetizationVerified: true,
        billingLifecycleVerified: false,
      }),
    });
    expect(unverified.productionCertified).toBe(false);
    expect(unverified.billingLifecycleRequired).toBe(true);
    expect(unverified.missingEvidence).toContain("billing_lifecycle");

    const verified = evaluateCertification({
      productContract: monetized,
      evidence: evidence({
        browserVerified: true,
        healthVerified: undefined,
        tenantIsolationVerified: true,
        monetizationVerified: true,
        billingLifecycleVerified: true,
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

  it("accepts verification evidence only for the same artifact version", () => {
    const events = [
      {
        kind: "monetization",
        artifactVersion: 4,
        payload: { verified: true },
      },
      {
        kind: "auth_lifecycle",
        artifactVersion: 4,
        payload: { verified: true },
      },
    ];
    expect(hasVerifiedMonetizationEvidence(events, 4)).toBe(true);
    expect(hasVerifiedMonetizationEvidence(events, 5)).toBe(false);
    expect(hasVerifiedArtifactEvidence(events, "auth_lifecycle", 4)).toBe(true);
    expect(hasVerifiedArtifactEvidence(events, "auth_lifecycle", 5)).toBe(false);
    expect(
      hasVerifiedArtifactEvidence(
        [{ kind: "auth_lifecycle", artifactVersion: 4, payload: { approved: true } }],
        "auth_lifecycle",
        4,
      ),
    ).toBe(false);
  });

  it("creates and persists real deployed monetization verification evidence", () => {
    const billingScaffold = readFileSync(
      "src/services/saasBillingScaffold.ts",
      "utf8",
    );
    const deployHealth = readFileSync("src/services/deployHealth.ts", "utf8");
    const production = readFileSync(
      "src/services/productionAutoDeploy.ts",
      "utf8",
    );

    expect(billingScaffold).toContain('"src/app/api/billing/health/route.ts"');
    expect(billingScaffold).toContain('"src/server/routes/billing/health.ts"');
    expect(deployHealth).toContain("verifyDeployedBilling");
    expect(deployHealth).toContain("/api/billing/health");
    expect(deployHealth).toContain('state === "connected"');
    expect(production).toContain("recordMonetizationVerification");
    expect(production).toContain('kind: "monetization"');
    expect(production).toContain("verified: billing.ok");
    expect(production).toContain(
      "artifactVersion: opts.snapshot?.version ?? null",
    );
    expect(production).toContain(
      "artifactSha256: opts.snapshot?.integrity.sha256 ?? artifactSha256",
    );
  });

  it("wires the certification engine into normal builds and self-healing", () => {
    const worker = readFileSync("src/services/build-worker.ts", "utf8");
    const healing = readFileSync("src/agents/selfHealing.ts", "utf8");
    const pipeline = readFileSync(
      "src/agents/.pipeline_parts/part4.txt",
      "utf8",
    );

    expect(worker).toContain("evaluateCertification({");
    expect(worker).toContain("verifiedMonetizationEvidence");
    expect(worker).toContain("evaluateFinalProductFactoryFlow({");
    expect(worker).toContain("finalProductFactoryFlow.productionReady");
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
