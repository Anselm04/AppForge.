import { describe, expect, it } from "vitest";
import { ALL_BUILDER_RESOURCES } from "../builderResourceLibrary.js";
import { parseBuilderResourceManifest } from "../resourceManifest.js";
import {
  assertBuilderResourceSupplyChainSafe,
  reviewBuilderResourceSupplyChain,
} from "../resourceSupplyChain.js";

describe("Builder Resource supply chain", () => {
  it("passes provenance/license review for every registered internal resource", () => {
    const failed = ALL_BUILDER_RESOURCES.flatMap((resource) => {
      const review = reviewBuilderResourceSupplyChain(resource);
      return review.ok
        ? []
        : [
            {
              id: resource.identity.resourceId,
              findings: review.findings,
            },
          ];
    });
    expect(failed).toEqual([]);
  });

  it("blocks credential-like values embedded in resource contracts", () => {
    const base = ALL_BUILDER_RESOURCES[0];
    if (!base) throw new Error("catalog unexpectedly empty");
    const unsafe = parseBuilderResourceManifest({
      ...base,
      identity: {
        ...base.identity,
        resourceId: "test.embedded-secret",
      },
      contracts: {
        ...base.contracts,
        inputContract: { secret: "sk_live_ABC123456789" },
      },
    });
    expect(() => assertBuilderResourceSupplyChainSafe(unsafe)).toThrow(
      /embedded-secret/,
    );
  });

  it("blocks external proprietary copied resources even when metadata otherwise parses", () => {
    const base = ALL_BUILDER_RESOURCES[0];
    if (!base) throw new Error("catalog unexpectedly empty");
    const unsafe = parseBuilderResourceManifest({
      ...base,
      identity: {
        ...base.identity,
        resourceId: "test.external-proprietary",
      },
      governance: {
        ...base.governance,
        provenance: "external competitor source",
        license: "PROPRIETARY",
      },
    });
    const review = reviewBuilderResourceSupplyChain(unsafe);
    expect(review.ok).toBe(false);
    expect(review.findings.map((finding) => finding.code)).toContain(
      "external-proprietary-copy",
    );
  });
});
