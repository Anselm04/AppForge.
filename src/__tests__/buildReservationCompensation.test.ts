import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projects = readFileSync("src/routers/projects.ts", "utf8");
const begin = projects.indexOf("let charged = false;");
const end = projects.indexOf('status: "running" as const', begin);
const admission = projects.slice(begin, end);

describe("build reservation compensation protects customer credits", () => {
  it("tracks a debit before subsequent reservation persistence", () => {
    const deducted = admission.indexOf("await deductCredits(");
    const charged = admission.indexOf("charged = true;");
    const reserved = admission.indexOf(
      "await updateProjectCreditsReserved(id, BUILD_CREDIT_COST);",
    );
    expect(deducted).toBeGreaterThan(-1);
    expect(charged).toBeGreaterThan(deducted);
    expect(reserved).toBeGreaterThan(charged);
  });

  it("exposes failed credit compensation and build claim recovery", () => {
    expect(admission).toContain("await addCredits(");
    expect(admission).toContain("refundReconciliationRequired = true;");
    expect(admission).toContain("build_start_refund_requires_reconciliation");
    expect(admission).toContain("build_start_claim_release_failed");
    expect(admission).not.toContain(
      "await updateProjectCreditsReserved(id, 0).catch(() => undefined)",
    );
    expect(admission).toContain(
      "Do not retry this project until the reservation is resolved.",
    );
  });

  it("offers a retryable queue error only after compensation succeeds", () => {
    const unresolved = admission.indexOf("if (refundReconciliationRequired) {");
    const saturated = admission.indexOf('err.name === "BuildQueueSaturatedError"');
    expect(unresolved).toBeGreaterThan(-1);
    expect(saturated).toBeGreaterThan(unresolved);
  });
});
