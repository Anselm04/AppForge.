import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const queueSource = readFileSync(
  resolve(process.cwd(), "src/services/build-queue.ts"),
  "utf8",
);
const workerSource = readFileSync(
  resolve(process.cwd(), "src/services/build-worker.ts"),
  "utf8",
);

describe("build queue billing semantics", () => {
  it("keeps terminal refund handling terminal while allowing bounded interruption recovery", () => {
    expect(queueSource).toContain("attempts: BUILD_QUEUE_MAX_ATTEMPTS");
    expect(queueSource).toContain("const BUILD_QUEUE_MAX_ATTEMPTS = 3");
    expect(queueSource).toContain("maxStalledCount: 2");

    const terminalCatch = workerSource.indexOf("} catch (err: unknown) {");
    const refund = workerSource.indexOf(
      'await refundReservation("Failed build")',
    );
    const finallyBlock = workerSource.indexOf("} finally {", refund);
    const rethrowAfterRefund = workerSource.indexOf("throw err", refund);

    expect(terminalCatch).toBeGreaterThan(-1);
    expect(refund).toBeGreaterThan(terminalCatch);
    expect(finallyBlock).toBeGreaterThan(refund);
    expect(
      rethrowAfterRefund === -1 || rethrowAfterRefund > finallyBlock,
    ).toBe(true);
  });

  it("uses a stable per-project BullMQ id to deduplicate starts", () => {
    expect(queueSource).toContain('jobId: `build-${job.projectId}`');
    expect(queueSource).toContain("queuedData.createdAt !== job.createdAt");
    expect(queueSource).not.toContain("build-${job.projectId}-${Date.now()}");
  });
});
