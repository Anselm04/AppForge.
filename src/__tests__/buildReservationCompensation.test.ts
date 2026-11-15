import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projects = readFileSync("src/routers/projects.ts", "utf8");
const begin = projects.indexOf("let charged = false;");
const end = projects.indexOf("return {\n        id,\n        status: \"running\"", begin);
const admission = projects.slice(begin, end);

describe("build reservation compensation protects customer credits", () => {
  it("marks deduction before a separate project reservation update can fail", () => {
    const deducted = admission.indexOf("await deductCredits(");
    const charged = admission.indexOf("charged = true;");
    const reserved = admission.indexOf(
      "await updateProjectCreditsReserved(id, BUILD_CREDIT_COST);",
    );
    expect(deducted).toBeGreaterThan(-1);
    expect(charged).toBeGreaterThan(deducted);
    expect(reserved).toBeGreaterThan(charged);
  });

  it("does not swallow failed credit compensation or claim recovery", () => {
    expect(admission).toContain("refundReconciliationRequired = true;");
    expect(admission).toContain("build_start_refund_requires_reconciliation");
    expect(admission).toContain("build_start_claim_release_failed");
    expect(admission).not.toContain("await addCredits(" + "\n" + "          ctx.user.id");
    expect(admission).not.toContain(").catch(() => undefined);\n          await updateProjectCreditsReserved(id, 0)");
    expect(admission).toContain("Do not retry this project until the reservation is resolved.");
  });

  it("preserves the retryable capacity error only after successful recovery", () => {
    const unresolved = admission.indexOf("if (refundReconciliationRequired) {");
    const saturated = admission.indexOf('err.name === "BuildQueueSaturatedError"');
    expect(unresolved).toBeGreaterThan(-1);
    expect(saturated).toBeGreaterThan(unresolved);
  });
});
