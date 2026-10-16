import { describe, expect, it } from "vitest";
import { BUILD_CAPABILITY_IDS } from "../../buildCapabilities.js";
import { createBuilderResourceLibraryRegistry } from "../builderResourceLibrary.js";

function capabilityResourceId(capability: string): string {
  return capability === "web_search"
    ? "capability.web-search"
    : `capability.${capability}`;
}

describe("Builder Resource domain implementation linkage", () => {
  it("keeps every domain pack source-backed without hidden composition dependencies", () => {
    const resources = createBuilderResourceLibraryRegistry().list();

    for (const capability of BUILD_CAPABILITY_IDS) {
      const domainResourceId = `domain.${capability}.contract-pack`;
      const domainResource = resources.find(
        (resource) => resource.identity.resourceId === domainResourceId,
      );
      const canonicalResourceId = capabilityResourceId(capability);
      const capabilityResource = resources.find(
        (resource) => resource.identity.resourceId === canonicalResourceId,
      );

      expect(domainResource, `missing ${domainResourceId}`).toBeTruthy();
      expect(
        domainResource?.implementation.sourcePaths,
        `${domainResourceId} must have source-backed runtime implementation`,
      ).toContain("src/lib/builderResources/domainRuntimeResources.ts");
      expect(domainResource?.implementation.testPaths).toContain(
        "src/lib/builderResources/__tests__/domainRuntimeResources.test.ts",
      );

      // Domain packs prove substantive implementation; selection remains explicit and contract-driven.
      expect(capabilityResource, `missing ${canonicalResourceId}`).toBeTruthy();
      expect(capabilityResource?.capabilities.dependencies).not.toContain(
        domainResourceId,
      );
    }
  });
});
