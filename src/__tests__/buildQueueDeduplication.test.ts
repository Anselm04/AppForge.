import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const queue = readFileSync(
  resolve(process.cwd(), "src/services/build-queue.ts"),
  "utf8",
);
const worker = readFileSync(
  resolve(process.cwd(), "src/services/build-worker.ts"),
  "utf8",
);

describe("build queue duplicate-start protection", () => {
  it("uses a stable per-project BullMQ job id", () => {
    expect(queue).toContain('jobId: `build-${job.projectId}`');
    expect(queue).toContain("queuedData.createdAt !== job.createdAt");
  });

  it("uses an atomic Redis NX claim before queue insertion", () => {
    expect(queue).toContain("NX: true");
    expect(queue).toContain("queueClaimKey(job.projectId)");
  });

  it("deduplicates degraded in-memory queue starts", () => {
    expect(queue).toContain("memoryQueuedProjects.has(job.projectId)");
    expect(queue).toContain("memoryQueuedProjects.add(job.projectId)");
  });

  it("refunds a paid reservation when a duplicate enqueue is blocked", () => {
    expect(queue).toContain("if (!job.reservationCharged) return");
    expect(queue).toContain(
      "build-duplicate-refund-${job.projectId}-${job.createdAt}",
    );
  });

  it("uses the same duplicate-refund identity if the duplicate reaches a worker", () => {
    expect(worker).toContain("if (activeJobs.has(job.projectId))");
    expect(worker).toContain("await refundActiveDuplicateReservation(job)");
    expect(worker).toContain(
      "build-duplicate-refund-${job.projectId}-${job.createdAt}",
    );
  });
});

describe("build event reconnect protection", () => {
  it("persists each worker event before publishing it", () => {
    const persistIndex = worker.indexOf("await appendBuildEvent(projectId, event, data)");
    const runtimeIndex = worker.indexOf(
      "publishRuntimeBuildEvent(projectId, event, data)",
    );
    const redisIndex = worker.indexOf(
      "await publishBuildEvent(projectId, event, data)",
    );

    expect(persistIndex).toBeGreaterThan(-1);
    expect(runtimeIndex).toBeGreaterThan(persistIndex);
    expect(redisIndex).toBeGreaterThan(runtimeIndex);
  });

  it("subscribes before checking persisted terminal state", () => {
    const subscribeIndex = queue.indexOf("await sub.subscribe(channel");
    const catchupIndex = queue.indexOf(
      "await getLatestTerminalBuildEvent(projectId)",
    );

    expect(subscribeIndex).toBeGreaterThan(-1);
    expect(catchupIndex).toBeGreaterThan(subscribeIndex);
  });

  it("self-closes subscriptions after either live or persisted terminal events", () => {
    expect(queue).toContain(
      "if (isTerminalEvent(parsed.event)) void closeSubscription()",
    );
    expect(queue).toContain("if (active && terminal)");
    expect(queue).toContain("await closeSubscription()");
  });
});
