import { describe, expect, it } from "vitest";
import { BUILTIN_BUILDER_RESOURCES } from "../builtinResourceCatalog.js";
import { createBuilderResourceVersion } from "../resourceGovernance.js";

describe("Builder Resource version evidence", () => {
  it("does not silently carry verified maturity into a new resource version", () => {
    const current = BUILTIN_BUILDER_RESOURCES.find(
      (resource) => resource.identity.resourceId === "core.authentication",
    );
    if (!current) throw new Error("missing authentication resource");

    const next = createBuilderResourceVersion(current, "1.1.0");

    expect(current.identity.version).toBe("1.0.0");
    expect(next.identity.version).toBe("1.1.0");
    expect(next.governance.maturityState).toBe("experimental");
    expect(next.evidence.lastVerifiedAt).toBeNull();
    expect(next.evidence.evidenceLedgerIds).toEqual([]);
    expect(next.evidence.adapterEvidence).toMatchObject({ discovered: true });
    expect(next.evidence.adapterEvidence.testsVerified).not.toBe(true);
    expect(next.evidence.adapterEvidence.runtimeVerified).not.toBe(true);
    expect(next.evidence.adapterEvidence.deploymentVerified).not.toBe(true);
    expect(next.evidence.adapterEvidence.securityScanVerified).not.toBe(true);
  });
});
