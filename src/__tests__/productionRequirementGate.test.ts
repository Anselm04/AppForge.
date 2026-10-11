import { resolveIntakeContract } from "../lib/productContract.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const runner = vi.hoisted(() => ({
  validateWithIsolatedBuildRunner: vi.fn(),
  isolatedBuildConfigured: vi.fn(() => true),
}));
vi.mock("../services/isolatedBuildRunner.js", () => runner);
import {
  validateGeneratedBuild,
  validateRequirementTestCoverage,
} from "../agents/buildValidator.js";
import { getStackScaffold } from "../services/stackScaffolds.js";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  runner.validateWithIsolatedBuildRunner.mockReset().mockResolvedValue({
    passed: true,
    stage: "complete",
    errors: [],
    durationMs: 1,
    isolationId: "reviewed-fixture",
  });
});
afterEach(() => vi.unstubAllEnvs());
const manifest = JSON.stringify({
  version: 1,
  requirements: [
    { id: "REQ-001", text: "Adding a task retains previous tasks" },
  ],
});
function fixture() {
  const files = getStackScaffold("react-node", "saas_application");
  for (const path of Object.keys(files))
    if (/test|spec/.test(path)) delete files[path];
  files["appforge.requirements.json"] = manifest;
  return files;
}
describe("production full-build acceptance gates", () => {
  it("rejects full validation without executable tests before contacting a runner", async () => {
    const result = await validateGeneratedBuild(fixture(), "react-node", {
      testsBlocking: true,
    });
    expect(result.passed).toBe(false);
    expect(result.stage).toBe("tests");
    expect(runner.validateWithIsolatedBuildRunner).not.toHaveBeenCalled();
  });
  it("rejects tests that omit requirement links even if a runner would pass", async () => {
    const files = {
      ...fixture(),
      "task.test.cjs":
        "require('node:test')('addition',()=>require('node:assert/strict').equal(1+1,2));",
    };
    const result = await validateGeneratedBuild(files, "react-node", {
      testsBlocking: true,
    });
    expect(result.passed).toBe(false);
    expect(result.stage).toBe("requirements");
    expect(runner.validateWithIsolatedBuildRunner).not.toHaveBeenCalled();
  });
  it("allows linked native Node tests to proceed to isolated execution", async () => {
    const files = {
      ...fixture(),
      "task.test.cjs":
        "// requirement: REQ-001\nrequire('node:test')('addition',()=>require('node:assert/strict').equal(1+1,2));",
    };
    const result = await validateGeneratedBuild(files, "react-node", {
      testsBlocking: true,
    });
    expect(result.passed).toBe(true);
    expect(runner.validateWithIsolatedBuildRunner).toHaveBeenCalledWith(
      files,
      "react-node",
    );
  });
});

describe("canonical no-payment scope constraint", () => {
  const scopeText =
    "Do not invent monetization; the prompt did not request payments";
  function scopeFixture() {
    return {
      "appforge.requirements.json": JSON.stringify({
        version: 1,
        requirements: [
          { id: "REQ-001", text: "Adding a task retains previous tasks" },
          { id: "REQ-005", text: scopeText },
        ],
      }),
      "task.test.cjs":
        "// requirement: REQ-001\nrequire('node:test')('addition',()=>require('node:assert/strict').equal(1+1,2));",
    };
  }
  it("verifies a canonical absence constraint without inventing a payment test", () => {
    const files = scopeFixture();
    expect(
      validateRequirementTestCoverage(
        files,
        ["task.test.cjs"],
        noPaymentContract(),
      ),
    ).toEqual([]);
  });
  it("rejects invented payment behavior even if all test markers are present", () => {
    const files = {
      ...scopeFixture(),
      "server/payments.js":
        "export function pay(stripe) { return stripe.checkout.sessions.create({}); }",
    };
    files["task.test.cjs"] += "\n// requirement: REQ-005";
    expect(
      validateRequirementTestCoverage(
        files,
        ["task.test.cjs"],
        noPaymentContract(),
      ).join("\n"),
    ).toContain("billing implementation exists");
  });
  it("does not exempt a manifest assertion absent from the canonical contract", () => {
    const files = scopeFixture();
    expect(
      validateRequirementTestCoverage(files, ["task.test.cjs"]).join("\n"),
    ).toContain("REQ-005 has no linked executable");
  });
  it("still requires behavioral coverage for the actual task workflow", () => {
    const files = scopeFixture();
    files["task.test.cjs"] = "test without requirement links";
    expect(
      validateRequirementTestCoverage(
        files,
        ["task.test.cjs"],
        noPaymentContract(),
      ).join("\n"),
    ).toContain("REQ-001 has no linked executable");
  });
});

function noPaymentContract() {
  const resolved = resolveIntakeContract(
    "Build a simple personal task tracker. Add tasks and retain them after reload.",
    "react-node",
  );
  if (!resolved.ok) throw new Error("Fixture must resolve");
  const contract = resolved.productContract;
  const scope = contract.functionalRequirements.find(
    (r) =>
      r.text ===
      "Do not invent monetization; the prompt did not request payments",
  );
  if (!scope) throw new Error("Fixture needs canonical scope constraint");
  return {
    ...contract,
    functionalRequirements: [
      ...contract.functionalRequirements.filter(
        (r) => r !== scope && r.id !== "REQ-005",
      ),
      { ...scope, id: "REQ-005" },
    ],
  };
}
