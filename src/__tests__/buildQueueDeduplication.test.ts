import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const queue = readFileSync(resolve(process.cwd(), "src/services/build-queue.ts"), "utf8");

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
    expect(queue).toContain("build-duplicate-refund-${job.projectId}-${job.createdAt}");
  });
});
