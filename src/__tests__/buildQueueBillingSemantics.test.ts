import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/services/build-queue.ts"),
  "utf8",
);

describe("build queue billing semantics", () => {
  it("does not queue-retry after worker terminal refund handling", () => {
    expect(source).toContain("attempts: 1");
    expect(source).not.toContain("attempts: 2");
  });

  it("uses a stable per-project BullMQ id to deduplicate starts", () => {
    expect(source).toContain('jobId: `build-${job.projectId}`');
    expect(source).toContain("queuedData.createdAt !== job.createdAt");
    expect(source).not.toContain("build-${job.projectId}-${Date.now()}");
  });
});
