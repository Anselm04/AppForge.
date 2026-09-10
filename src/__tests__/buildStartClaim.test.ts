import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const claim = readFileSync(
  resolve(process.cwd(), "src/services/build-claim.ts"),
  "utf8",
);
const queue = readFileSync(
  resolve(process.cwd(), "src/services/build-queue.ts"),
  "utf8",
);

describe("concurrent build start protection", () => {
  it("atomically claims a startable project before build execution", () => {
    expect(claim).toContain("claimProjectBuildStart");
    expect(claim).toContain(
      "inArray(schema.projects.status, STARTABLE_BUILD_STATUSES)",
    );
    expect(claim).toContain("return claimed.length === 1");
  });

  it("deduplicates every queue backend and refunds a duplicate paid reservation", () => {
    expect(queue).toContain('jobId: `build-${job.projectId}`');
    expect(queue).toContain("NX: true");
    expect(queue).toContain("memoryQueuedProjects.has(job.projectId)");
    expect(queue).toContain("if (!job.reservationCharged) return");
  });
});
