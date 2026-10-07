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
    expect(queue).toContain('bullWorker.on("stalled"');
  });

  it("replays an already-finished project after worker restart instead of rebuilding it", () => {
    const queue = source("src/services/build-queue.ts");
    const recoveryCheck = queue.indexOf("recoverAlreadyCompletedBuild(parsed.job)");
    const workerRun = queue.indexOf("await runBuildJob(job.data)");

    expect(queue).toContain("async function recoverAlreadyCompletedBuild");
    expect(queue).toContain('status !== "validated"');
    expect(queue).toContain('status !== "production-certified"');
    expect(queue).toContain("recoveredAfterWorkerRestart: true");
    expect(queue).toContain("await getCurrentArtifact(job.projectId)");
    expect(recoveryCheck).toBeGreaterThan(-1);
    expect(workerRun).toBeGreaterThan(recoveryCheck);
  });

  it("persists a reconstructed terminal recovery event before publishing it", () => {
    const queue = source("src/services/build-queue.ts");
    const append = queue.indexOf(
      'await appendBuildEvent(job.projectId, "done", payload)',
    );
    const publish = queue.indexOf(
      'await publishBuildEvent(job.projectId, "done", payload)',
    );

    expect(append).toBeGreaterThan(-1);
    expect(publish).toBeGreaterThan(append);
    expect(queue).toContain("getLatestTerminalBuildEvent(job.projectId)");
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
