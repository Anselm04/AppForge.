import { describe, expect, it } from "vitest";
import { assessFactoryExecution } from "../lib/factoryExecutionGate.js";

describe("one application factory execution gate", () => {
  it("rejects successful structure, syntax or unproven stages", () => {
    for (const stage of ["structure", "python_syntax", "tests", "install", "build", ""]) {
      const decision = assessFactoryExecution({ passed: true, stage });
      expect(decision.state, stage).toBe("source_only");
      expect(decision.verified, stage).toBe(false);
    }
  });

  it("requires passing native execution evidence rather than an AI success claim", () => {
    expect(assessFactoryExecution({ passed: true, stage: "runtime" }).verified).toBe(true);
    expect(assessFactoryExecution({ passed: true, stage: "docker_node" }).verified).toBe(true);
    expect(
      assessFactoryExecution({ passed: true, stage: "isolated_runtime" }).verified,
    ).toBe(true);
    expect(assessFactoryExecution({ passed: true, stage: "unknown" }).verified).toBe(false);
    expect(assessFactoryExecution({ passed: false, stage: "runtime" }).verified).toBe(false);
  });

  it("preserves actionable failure errors for downstream factory stages", () => {
    expect(
      assessFactoryExecution({
        passed: false,
        stage: "runtime",
        errors: ["Port 3000 did not respond"],
      }),
    ).toEqual({
      state: "failed",
      verified: false,
      reason: "Port 3000 did not respond",
      stage: "runtime",
    });
  });
});
