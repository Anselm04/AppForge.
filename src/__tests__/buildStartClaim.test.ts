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
const route = readFileSync(
  resolve(process.cwd(), "src/routes/build.ts"),
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

  it("requires the route to claim before charging or enqueueing", () => {
    expect(route).toContain('from "../services/build-claim.js"');
    expect(route).toContain("await claimProjectBuildStart(projectId, user.id)");
    expect(
      route.indexOf("claimProjectBuildStart(projectId, user.id)"),
    ).toBeLessThan(route.indexOf("await deductCredits(user.id, BUILD_COST"));
    expect(route).toContain("releaseProjectBuildClaim(");
    expect(route).toContain("build-start-refund-");
  });

  it("rejects a stale simultaneous starter instead of replaying old SSE history", () => {
    expect(route).toContain("if (!claimed)");
    expect(route).toContain('error: "build_already_started"');
  });

  it("deduplicates every queue backend and refunds a duplicate paid reservation", () => {
    expect(queue).toContain('jobId: `build-${job.projectId}`');
    expect(queue).toContain("NX: true");
    expect(queue).toContain("memoryQueuedProjects.has(job.projectId)");
    expect(queue).toContain("if (!job.reservationCharged) return");
  });
});
