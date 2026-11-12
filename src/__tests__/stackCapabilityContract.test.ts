import { describe, expect, it } from "vitest";
import { stackCapabilityContract } from "../lib/stackCapabilityContract.js";

describe("stack verification contracts", () => {
  it("does not market structural Flutter scaffolds as certified builds", () => {
    const flutter = stackCapabilityContract("flutter-node");
    expect(flutter.generationMode).toBe("structural");
    expect(flutter.certificationLevel).toBe("source_only");
    expect(flutter.canClaimProductionReadyWithoutExecution).toBe(false);
    expect(flutter.requiredChecks.map((check) => check.id)).toContain(
      "native_build",
    );
    expect(flutter.releaseRequirements).toContain(
      "Actual submission and provider review/approval evidence",
    );
  });

  it("requires real browser evidence for runnable web stacks", () => {
    const web = stackCapabilityContract("react-node");
    expect(web.certificationLevel).toBe("runnable_candidate");
    expect(web.canClaimProductionReadyWithoutExecution).toBe(false);
    expect(web.requiredChecks.map((check) => check.id)).toContain(
      "browser_runtime",
    );
  });

  it("requires real compilation and security across stacks", () => {
    for (const id of ["react-node", "flutter-node", "static-html"]) {
      const result = stackCapabilityContract(id);
      expect(result.requiredChecks.map((check) => check.id)).toEqual(
        expect.arrayContaining(["source_integrity", "build", "security"]),
      );
    }
  });
});
