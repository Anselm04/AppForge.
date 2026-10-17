import { describe, expect, it } from "vitest";
import { evaluateFinalProductFactoryFlow } from "../lib/finalProductFactoryFlow.js";
import { buildProductContract } from "../lib/productContract.js";
import { evaluateCertification } from "../lib/certificationLogic.js";
import {
  filterDeployOptionsForStack,
  projectReadinessForApi,
} from "../lib/stackPresentation.js";

const contract = buildProductContract("Build a website for a bakery");
const decision = evaluateCertification({
  productContract: contract,
  evidence: {
    artifactPresent: true,
    generatedFileCount: 10,
    requirementsResolved: true,
    behavioralTestsVerified: true,
    runtimeVerified: true,
    securityVerified: true,
    deploymentVerified: true,
    browserVerified: true,
    operationalVerified: true,
    recoveryVerified: true,
  },
});
function report(overrides = {}) {
  return evaluateFinalProductFactoryFlow({
    project: {
      description: contract.originalPrompt,
      techStack: contract.selectedTechnologyStack,
      productContract: contract,
      promptIntent: null,
      researchRecord: null,
      productPlan: null,
      agentCoordination: null,
      requirementManifest: null,
    },
    artifact: null,
    certificationDecision: { ...decision, ...overrides },
    monetizationVerified: true,
    recoveryVerified: true,
  });
}

describe("factory readiness safeguards", () => {
  it("rejects certification from another stack or product even if it claims complete evidence", () => {
    expect(decision.productionCertified).toBe(true);
    expect(report().incompleteSteps).not.toContain("honest_certification");
    for (const mismatch of [{ stack: "next-node" }, { productType: "game" }]) {
      expect(report(mismatch).incompleteSteps).toContain(
        "honest_certification",
      );
      expect(report(mismatch).productionReady).toBe(false);
    }
  });

  it("downgrades stale structural and unknown API certification without changing persisted state", () => {
    for (const techStack of [
      "flutter-node",
      "python-service",
      "chrome-extension",
      "unknown",
      null,
    ]) {
      const persisted = {
        id: 1,
        techStack,
        status: "production-certified",
        outputMaturity: "certified",
      };
      expect(projectReadinessForApi(persisted)).toMatchObject({
        id: 1,
        status: "validated",
        outputMaturity: "structural",
        sourceDeliverable: true,
      });
      expect(persisted.status).toBe("production-certified");
    }
  });

  it("preserves runnable certification and in-progress structural status", () => {
    const runnable = {
      techStack: "react-node",
      status: "production-certified",
      outputMaturity: "certified",
    };
    expect(projectReadinessForApi(runnable)).toEqual(runnable);
    expect(
      projectReadinessForApi({ techStack: "flutter-node", status: "building" })
        .status,
    ).toBe("building");
  });

  it("only offers ZIP for structural or unknown stacks and preserves supported runnable destinations", () => {
    const options = {
      zip: { configured: true },
      fly: { configured: true },
      preview: { configured: true },
      netlify: { configured: false },
      unsupported: { configured: true },
    };
    for (const stack of [
      "flutter-node",
      "python-service",
      "chrome-extension",
      "unknown",
    ]) {
      expect(filterDeployOptionsForStack(stack, options)).toEqual({
        zip: options.zip,
      });
    }
    const runnable = filterDeployOptionsForStack("react-node", options);
    expect(runnable.fly).toEqual(options.fly);
    expect(runnable.preview).toEqual(options.preview);
    expect(runnable.unsupported).toBeUndefined();
    expect(options.unsupported).toBeDefined();
  });
});
