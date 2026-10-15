import { describe, expect, it } from "vitest";
import { createBuilderResourceLibraryRegistry } from "../builderResourceLibrary.js";
import { PROGRAMME_REFERENCE_ARCHITECTURES } from "../programmeReferenceArchitectures.js";
import { REFERENCE_ARCHITECTURE_RESOURCES } from "../referenceArchitectureResources.js";
import { validateReferenceArchitecture } from "../referenceArchitectures.js";

const REQUIRED_REFERENCE_IDS = [
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
  "realtime-collaboration",
  "data-application",
  "subscription-app",
] as const;

describe("reference architecture programme", () => {
  it("covers every requested major product structure", () => {
    const ids = new Set(
      PROGRAMME_REFERENCE_ARCHITECTURES.map((architecture) => architecture.id),
    );
    for (const id of REQUIRED_REFERENCE_IDS) expect(ids.has(id)).toBe(true);
  });

  it("keeps each reference architecture configurable rather than executable as a copied whole app", () => {
    expect(REFERENCE_ARCHITECTURE_RESOURCES).toHaveLength(
      PROGRAMME_REFERENCE_ARCHITECTURES.length,
    );
    for (const resource of REFERENCE_ARCHITECTURE_RESOURCES) {
      expect(resource.identity.resourceType).toBe("reference_architecture");
      expect(resource.implementation.exportPolicy).toBe("reference-only");
      expect(resource.adaptation.configurableFields.length).toBeGreaterThan(0);
      expect(resource.implementation.requiresLiveLibraryAtRuntime).toBe(false);
    }
  });

  it("references only real internal resources and detects composition conflicts honestly", () => {
    const registry = createBuilderResourceLibraryRegistry();
    const validations = PROGRAMME_REFERENCE_ARCHITECTURES.map((architecture) =>
      validateReferenceArchitecture(architecture, registry),
    );
    expect(
      validations.flatMap((validation) => validation.missingResourceIds),
    ).toEqual([]);
    expect(
      validations.filter((validation) => !validation.ok).map((validation) => ({
        id: validation.recipeId,
        conflicts: validation.compositionConflictKinds,
      })),
    ).toEqual([]);
  });
});
