import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("src/services/build-worker.ts", "utf8");
const start = worker.indexOf("async function rejectInvalidBuildJob(");
const finish = worker.indexOf("function assertPersistedContract(", start);
const admission = worker.slice(start, finish);

describe("invalid queued build compensation", () => {
  it("never refunds a malformed job while another attempt is active", () => {
    const active = admission.indexOf("if (activeJobs.has(projectId))");
    const refund = admission.indexOf("await addCredits(");
    expect(active).toBeGreaterThan(0);
    expect(refund).toBeGreaterThan(active);
    expect(admission).toContain("invalid_build_job_while_attempt_active");
  });

  it("preserves uncertain credits and records explicit reconciliation", () => {
    const error = admission.indexOf(
      "invalid_build_job_refund_requires_reconciliation",
    );
    const clear = admission.indexOf(
      "await updateProjectCreditsSpent(projectId, 0)",
    );
    expect(error).toBeGreaterThan(0);
    expect(clear).toBeGreaterThan(error);
    expect(admission).toContain(
      'await updateProjectStatus(projectId, "failed", "credit_refund_failure")',
    );
    expect(admission).toContain(
      "Do not retry until the reservation is reconciled.",
    );
    expect(admission).toContain("reservationId: refundKey");
    expect(admission).not.toContain("invalid_build_job_refund_failed");
  });
});
