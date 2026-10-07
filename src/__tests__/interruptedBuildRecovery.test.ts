import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("launch bar #4 interrupted build recovery", () => {
  it("configures bounded durable BullMQ retries and stalled-worker recovery", () => {
    const queue = source("src/services/build-queue.ts");

    expect(queue).toContain("const BUILD_QUEUE_MAX_ATTEMPTS = 3");
    expect(queue).toContain("maxStalledCount: 2");
    expect(queue).toContain("attempts: BUILD_QUEUE_MAX_ATTEMPTS");
    expect(queue).toContain('type: "exponential"');
    expect(queue).toContain("delay: BUILD_QUEUE_RETRY_BASE_MS");
    expect(queue).toContain("attempt: job.attemptsMade + 1");
    expect(queue).toContain("maxAttempts: BUILD_QUEUE_MAX_ATTEMPTS");
  });

  it("retries transient worker failures without refunding or emitting a terminal error early", () => {
    const worker = source("src/services/build-worker.ts");

    expect(worker).toContain("export type BuildExecutionContext");
    expect(worker).toContain("const retryableInterruption =");
    expect(worker).toContain('await emit(projectId, "recovery"');
    expect(worker).toContain("throw err;");
    expect(worker.indexOf("if (retryableInterruption)")).toBeLessThan(
      worker.indexOf('await refundReservation("Failed build")'),
    );
  });

  it("recognizes an already-finished exact project after worker restart instead of rebuilding it", () => {
    const worker = source("src/services/build-worker.ts");

    expect(worker).toContain("recoverAlreadyCompletedBuild");
    expect(worker).toContain('status === "production-certified"');
    expect(worker).toContain('status === "validated"');
    expect(worker).toContain('recoveredAfterWorkerRestart: true');
  });

  it("keeps reconnect recovery backed by persisted events rather than client memory", () => {
    const route = source("src/routes/build.ts");
    const eventStore = source("src/services/build-event-store.ts");

    expect(route).toContain("getBuildEventsSince(projectId, sinceEventId)");
    expect(route).toContain("subscribeBuildEvents(projectId");
    expect(eventStore).toContain("INSERT INTO build_events");
    expect(eventStore).toContain("ORDER BY id ASC");
  });
});
