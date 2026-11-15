import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const queue = readFileSync("src/services/build-queue.ts", "utf8");
const claim = readFileSync("src/services/build-claim.ts", "utf8");
const start = queue.indexOf("async function recoverFailedQueuedBuild(");
const end = queue.indexOf(
  "export async function getBuildQueueDiagnostics(",
  start,
);
const recovery = queue.slice(start, end);

describe("terminal failed queue compensation", () => {
  it("wins the conditional project transition before issuing any refund", () => {
    const paused = recovery.indexOf("await pauseFailedQueueAttempt(");
    const credit = recovery.indexOf("await addCredits(");
    expect(paused).toBeGreaterThan(-1);
    expect(credit).toBeGreaterThan(paused);
    expect(recovery).toContain("job.reservationCharged,");
  });

  it("locks pending refunds out of fresh project claims", () => {
    expect(claim).toContain(
      'ne(schema.projects.pauseReason, "refund_pending")',
    );
    expect(recovery).toContain("terminal_queue_refund_requires_reconciliation");
    expect(recovery).toContain(
      'await pauseProject(projectId, "credit_refund_failure")',
    );
  });

  it("clears reserved credits only after refund succeeds", () => {
    const refund = recovery.indexOf("await addCredits(");
    const clear = recovery.indexOf(
      "await updateProjectCreditsSpent(projectId, 0)",
    );
    expect(clear).toBeGreaterThan(refund);
    expect(recovery).toContain(
      'await pauseProject(projectId, "retry_after_error")',
    );
  });
});
