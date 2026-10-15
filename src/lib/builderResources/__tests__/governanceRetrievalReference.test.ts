import { describe, expect, it } from "vitest";
import {
  BUILTIN_BUILDER_RESOURCES,
  createBuiltinBuilderResourceRegistry,
} from "../builtinResourceCatalog.js";
import {
  assertPromotionReviewComplete,
  createBuilderResourceVersion,
  deprecateBuilderResource,
  quarantineBuilderResource,
  usageRecordForResource,
} from "../resourceGovernance.js";
import {
  applyResourceFailureDecision,
  diagnoseBuilderResourceFailure,
} from "../resourceRepair.js";
import {
  compactResourcePromptContext,
  retrieveBuilderResources,
} from "../resourceRetrieval.js";
import {
  REFERENCE_ARCHITECTURES,
  validateReferenceArchitecture,
} from "../referenceArchitectures.js";

describe("Builder Resource governance", () => {
  const auth = BUILTIN_BUILDER_RESOURCES.find(
    (resource) => resource.identity.resourceId === "core.authentication",
  )!;

  it("versions without silently mutating the proven resource", () => {
    const next = createBuilderResourceVersion(auth, "1.1.0");
    expect(auth.identity.version).toBe("1.0.0");
    expect(next.identity.version).toBe("1.1.0");
    expect(usageRecordForResource(auth)).toMatchObject({
      resourceId: "core.authentication",
      version: "1.0.0",
    });
  });

  it("quarantines regressions and deprecates with an explicit replacement", () => {
    const quarantined = quarantineBuilderResource(auth, "behavior regression");
    expect(quarantined.governance.quarantine?.quarantined).toBe(true);
    expect(quarantined.governance.maturityState).toBe("experimental");

    const deprecated = deprecateBuilderResource(auth, "core.authentication.v2");
    expect(deprecated.governance.deprecationStatus).toBe("deprecated");
    expect(deprecated.governance.replacementResourceId).toBe(
      "core.authentication.v2",
    );
  });

  it("blocks customer-build promotion until every sanitization/review gate passes", () => {
    expect(() =>
      assertPromotionReviewComplete({
        generalized: true,
        customerDataRemoved: true,
        secretsRemoved: true,
        deduplicated: true,
        licenseReviewed: false,
        securityReviewed: true,
        testsAdded: true,
        manifestCreated: true,
      }),
    ).toThrow(/licenseReviewed/);
  });
});

describe("Builder Resource repair diagnosis", () => {
  it("repairs the smallest responsible scope instead of regenerating everything", () => {
    expect(
      diagnoseBuilderResourceFailure({
        message: "package version incompatible",
        resourceId: "core.billing",
      }).repairScope,
    ).toBe("resource-version");
    expect(
      diagnoseBuilderResourceFailure({
        message: "adaptation failed",
        adaptationPath: "branding.primaryColor",
      }).repairScope,
    ).toBe("adaptation");
    expect(
      diagnoseBuilderResourceFailure({
        message: "duplicate route",
        conflictKind: "route",
      }).repairScope,
    ).toBe("composition");
    expect(
      diagnoseBuilderResourceFailure({
        message: "generated custom code defect",
        customFile: "src/custom.ts",
      }).repairScope,
    ).toBe("custom-code");
  });

  it("quarantines a resource defect but not an external composition conflict", () => {
    const auth = BUILTIN_BUILDER_RESOURCES.find(
      (resource) => resource.identity.resourceId === "core.authentication",
    )!;
    const defect = diagnoseBuilderResourceFailure({
      message: "behavioral regression inside reusable auth module",
      resourceId: auth.identity.resourceId,
    });
    expect(
      applyResourceFailureDecision(auth, defect).governance.quarantine
        ?.quarantined,
    ).toBe(true);
  });
});

describe("metadata-first Builder Resource retrieval", () => {
  it("loads content only for selected resources", async () => {
    const registry = createBuiltinBuilderResourceRegistry();
    const loaded: string[] = [];
    const result = await retrieveBuilderResources({
      registry,
      query: { requiredCapabilities: ["authentication"] },
      limit: 1,
      loadContent: (resource) => {
        loaded.push(resource.identity.resourceId);
        return resource.implementation.sourcePaths;
      },
    });

    expect(result.metrics.catalogSize).toBeGreaterThan(20);
    expect(result.metrics.contentLoads).toBe(1);
    expect(loaded).toEqual(["core.authentication"]);
    expect(result.metrics.selectedResourceIds).toEqual([
      "core.authentication@1.0.0",
    ]);
  });

  it("builds compact selected-resource context instead of dumping the catalog", () => {
    const auth = BUILTIN_BUILDER_RESOURCES.find(
      (resource) => resource.identity.resourceId === "core.authentication",
    )!;
    const context = compactResourcePromptContext([auth]);
    expect(context).toContain("core.authentication@1.0.0");
    expect(context).not.toContain("capability.architecture");
  });
});

describe("reference architectures", () => {
  it("covers every requested major product class with composable recipes", () => {
    const ids = new Set(REFERENCE_ARCHITECTURES.map((recipe) => recipe.id));
    for (const expected of [
      "saas",
      "ecommerce",
      "marketplace",
      "crm",
      "project-management",
      "analytics",
      "social-community",
      "education",
      "healthcare",
      "fintech",
      "booking",
      "real-estate",
      "fitness",
      "travel",
      "restaurant",
      "portfolio",
      "content-news",
      "ai-agent",
      "automation",
      "api-service",
      "mobile-consumer",
      "desktop",
      "browser-extension",
      "game",
      "iot",
    ]) {
      expect(
        ids.has(expected),
        `missing reference architecture ${expected}`,
      ).toBe(true);
    }
  });

  it("does not reference missing internal resources", () => {
    const registry = createBuiltinBuilderResourceRegistry();
    const results = REFERENCE_ARCHITECTURES.map((architecture) =>
      validateReferenceArchitecture(architecture, registry),
    );
    const missing = results.flatMap((result) => result.missingResourceIds);
    expect(missing).toEqual([]);
  });
});
