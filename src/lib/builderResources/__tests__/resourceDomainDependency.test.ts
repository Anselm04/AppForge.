import { describe, expect, it } from "vitest";
import { createBuilderResourceLibraryRegistry } from "../builderResourceLibrary.js";
import { BUILD_CAPABILITY_IDS } from "../../buildCapabilities.js";

describe("canonical capability domain dependencies", () => {
  it("links every canonical capability resource to its substantive private domain pack", () => {
    const resources = createBuilderResourceLibraryRegistry().list();

    for (const capability of BUILD_CAPABILITY_IDS) {
      const canonical = resources.find(
        (resource) =>
          resource.identity.resourceId === `capability.${capability.replace(/_/g, "-")}` ||
          resource.identity.resourceId === `capability.${capability}`,
      );
      expect(canonical, capability).toBeTruthy();
      expect(canonical?.capabilities.dependencies).toContain(
        `domain.${capability}.contract-pack`,
      );

      const domainPack = resources.find(
        (resource) =>
          resource.identity.resourceId === `domain.${capability}.contract-pack`,
      );
      expect(domainPack?.implementation.sourcePaths).toContain(
        "src/lib/builderResources/domainRuntimeResources.ts",
      );
      expect(domainPack?.implementation.testPaths).toContain(
        "src/lib/builderResources/__tests__/domainRuntimeResources.test.ts",
      );
    }
  });
});
