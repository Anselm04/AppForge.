import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/routes/generate.ts", "utf8");
const start = route.indexOf("let charged = false;");
const finish = route.indexOf("res.json({\n      id,", start);
const admission = route.slice(start, finish);

describe("REST generation admission credit recovery", () => {
  it("tracks successful debits before enqueueing", () => {
    const debit = admission.indexOf("await deductCredits(");
    const marked = admission.indexOf("charged = true;");
    const queued = admission.indexOf("await enqueueBuild(");
    expect(debit).toBeGreaterThan(-1);
    expect(marked).toBeGreaterThan(debit);
    expect(queued).toBeGreaterThan(marked);
  });

  it("does not silently accept an unconfirmed refund or claim release", () => {
    expect(admission).toContain("reconciliationRequired = true;");
    expect(admission).toContain(
      "generate_build_refund_requires_reconciliation",
    );
    expect(admission).toContain("generate_build_claim_release_failed");
    expect(admission).toContain("recordProjectEvidence({");
    expect(admission).toContain(
      'reconciliationRequired ? "credit_refund_failure" : null',
    );
    expect(admission).toContain("res.status(409).json({");
    expect(admission).toContain('"build_credit_reconciliation_required"');
    expect(admission).toContain("Do not retry this project");
    expect(admission).not.toContain(
      'await releaseProjectBuildClaim(id, user.id, "pending", null);',
    );
  });
});
