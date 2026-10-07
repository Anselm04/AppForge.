import { describe, expect, it } from "vitest";
import {
  evaluateCertification,
  hasVerifiedMonetizationEvidence,
} from "../lib/certificationLogic.js";
import type { ProductContract } from "../lib/productContract.js";

function contract(overrides: Partial<ProductContract> = {}): ProductContract {
  return {
    version: 2,
    originalPrompt: "Build a paid multi-tenant SaaS for teams",
    productType: "saas_application",
    productFamilies: ["frontend", "backend", "database", "auth", "billing"],
    targetUsers: ["teams"],
    userRoles: ["member", "admin"],
    coreWorkflows: ["Sign in and use paid team workspace"],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: "Users authenticate before accessing workspace data",
        category: "security",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: ["Reliable"],
    dataModels: ["Workspace", "Membership"],
    integrations: ["Stripe"],
    securityRequirements: [
      "Authentication is enforced server-side",
      "Tenant data cannot cross workspace boundaries",
    ],
    deploymentRequirements: ["Verified deployment"],
    monetizationRequirements: ["Paid subscription"],
    selectedTechnologyStack: "react-node",
    researchRequirements: [],
    runtimeRequirements: ["Healthy runtime"],
    secondaryCapabilities: [
      "authentication",
      "database",
      "billing",
      "teams",
      "administration",
      "deployment",
    ],
    intentConfidence: 1,
    canonicalInterpretation: "Paid multi-tenant SaaS",
    contractDerivation: "prompt_deterministic",
    ...overrides,
  };
}

function evidence(overrides = {}) {
  return {
    artifactPresent: true,
    generatedFileCount: 20,
    requirementsResolved: true,
    behavioralTestsVerified: true,
    runtimeVerified: true,
    securityVerified: true,
    deploymentVerified: true,
    browserVerified: true,
    monetizationVerified: true,
    operationalVerified: true,
    recoveryVerified: true,
    ...overrides,
  };
}

describe("launch bar #5 generated SaaS certification", () => {
  it("names auth lifecycle and tenant isolation as blocking evidence for paid/authenticated SaaS", () => {
    const decision = evaluateCertification({
      productContract: contract(),
      evidence: evidence({ securityVerified: false }),
    });

    expect(decision.productionCertified).toBe(false);
    expect(decision.missingEvidence).toEqual(
      expect.arrayContaining([
        "security",
        "auth_lifecycle",
        "tenant_isolation",
      ]),
    );
  });

  it("requires a fully connected deployed billing lifecycle event", () => {
    const artifactVersion = 7;
    const weakEvidence = [
      {
        kind: "monetization",
        artifactVersion,
        payload: {
          verified: true,
          configured: false,
          providerVerified: false,
          state: "disconnected",
        },
      },
    ];
    const strongEvidence = [
      {
        kind: "monetization",
        artifactVersion,
        payload: {
          verified: true,
          configured: true,
          providerVerified: true,
          state: "connected",
        },
      },
    ];

    expect(hasVerifiedMonetizationEvidence(weakEvidence, artifactVersion)).toBe(
      false,
    );
    expect(
      hasVerifiedMonetizationEvidence(strongEvidence, artifactVersion),
    ).toBe(true);
  });
});
