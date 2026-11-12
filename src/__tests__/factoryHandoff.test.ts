import { describe, expect, it } from "vitest";
import { evaluateFactoryHandoff } from "../lib/factoryHandoff.js";

const sha = "a".repeat(64);
const base = {
  snapshotId: 45,
  artifactVersion: 7,
  artifactSha256: sha,
  files: { "src/main.tsx": "export const app = true" },
};

describe("one authoritative factory artifact handoff", () => {
  it("requires actual runtime execution before labelling a web build verified", () => {
    const result = evaluateFactoryHandoff({
      ...base,
      stack: "react-node",
      validationResult: { passed: true, stage: "structure" },
    });
    expect(result.stage).toBe("source_ready");
    expect(result.runtimeVerified).toBe(false);
    expect(result.problems).toContain(
      "Runnable stack lacks executed build/runtime proof.",
    );
  });

  it("recognizes an executed web runtime validation tied to saved files", () => {
    const result = evaluateFactoryHandoff({
      ...base,
      stack: "react-node",
      validationResult: { passed: true, stage: "runtime" },
    });
    expect(result.stage).toBe("runtime_verified");
    expect(result.runtimeVerified).toBe(true);
    expect(result.artifactSha256).toBe(sha);
  });

  it("does not turn structural Flutter scaffolding into native certification", () => {
    const result = evaluateFactoryHandoff({
      ...base,
      stack: "flutter-node",
      validationResult: { passed: true, stage: "structure" },
    });
    expect(result.stage).toBe("source_ready");
    expect(result.runtimeVerified).toBe(false);
  });

  it("does not accept arbitrary isolated stage names without explicit proof", () => {
    const result = evaluateFactoryHandoff({
      ...base,
      stack: "react-node",
      validationResult: { passed: true, stage: "isolated_runtime" },
    });
    expect(result.runtimeVerified).toBe(false);
  });

  it("blocks missing persistent artifact identity", () => {
    const result = evaluateFactoryHandoff({
      ...base,
      stack: "react-node",
      artifactSha256: "invalid",
      validationResult: { passed: true, stage: "runtime" },
    });
    expect(result.stage).toBe("blocked");
    expect(result.sourceReady).toBe(false);
  });
});
