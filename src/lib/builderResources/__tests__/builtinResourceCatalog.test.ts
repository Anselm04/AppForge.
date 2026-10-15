import { describe, expect, it } from "vitest";
import { BUILD_CAPABILITY_IDS } from "../../buildCapabilities.js";
import {
  BUILTIN_BUILDER_RESOURCES,
  builtinResourceCounts,
  createBuiltinBuilderResourceRegistry,
} from "../builtinResourceCatalog.js";
import { CORE_BUILDER_RESOURCE_CAPABILITY_IDS } from "../resourceCapabilities.js";

describe("built-in Builder Resource catalog", () => {
  it("covers every existing AppForge build-capability category with real source-backed resources", () => {
    const categories = new Set(
      BUILTIN_BUILDER_RESOURCES.map((resource) => resource.identity.category),
    );
    for (const capability of BUILD_CAPABILITY_IDS) {
      expect(categories.has(capability), `missing category ${capability}`).toBe(
        true,
      );
      const resources = BUILTIN_BUILDER_RESOURCES.filter(
        (resource) => resource.identity.category === capability,
      );
      expect(
        resources.some(
          (resource) => resource.implementation.sourcePaths.length > 0,
        ),
        `category ${capability} has no source-backed resource`,
      ).toBe(true);
    }
  });

  it("covers the cross-cutting core capability packs requested by the programme", () => {
    const provided = new Set(
      BUILTIN_BUILDER_RESOURCES.flatMap(
        (resource) => resource.capabilities.capabilitiesProvided,
      ),
    );
    for (const capability of CORE_BUILDER_RESOURCE_CAPABILITY_IDS) {
      expect(
        provided.has(capability),
        `missing core capability ${capability}`,
      ).toBe(true);
    }
  });

  it("keeps the private library build-time only and separate from the Template Marketplace", () => {
    expect(
      BUILTIN_BUILDER_RESOURCES.every(
        (resource) => !resource.implementation.requiresLiveLibraryAtRuntime,
      ),
    ).toBe(true);
    expect(
      BUILTIN_BUILDER_RESOURCES.some((resource) =>
        resource.implementation.sourcePaths.includes("src/data/templates.ts"),
      ),
    ).toBe(false);
  });

  it("contains reusable design-system resources rather than one mandatory visual family", () => {
    const design = BUILTIN_BUILDER_RESOURCES.filter((resource) =>
      resource.identity.resourceId.startsWith("design."),
    );
    expect(design.length).toBeGreaterThanOrEqual(2);
    expect(
      design.every((resource) => resource.adaptation.brandingHooks.length > 0),
    ).toBe(true);
  });

  it("builds a deterministic queryable registry with category counts", () => {
    const registry = createBuiltinBuilderResourceRegistry();
    expect(registry.list()).toHaveLength(BUILTIN_BUILDER_RESOURCES.length);
    expect(Object.keys(builtinResourceCounts())).toEqual(
      Object.keys(builtinResourceCounts()).slice().sort(),
    );
    expect(
      registry.query({ requiredCapabilities: ["authentication"] })[0]?.resource
        .identity.resourceId,
    ).toBe("core.authentication");
  });
});
