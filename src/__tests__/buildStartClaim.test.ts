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
const createRoute = readFileSync(
  resolve(process.cwd(), "src/routers/projects.ts"),
  "utf8",
);
const streamRoute = readFileSync(
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

  it("keeps explicitly user-cancelled paused projects non-startable", () => {
    expect(claim).toContain(
      'ne(schema.projects.pauseReason, "user_cancelled")',
    );
    expect(claim).toContain(
      'ne(schema.projects.pauseReason, "user-cancelled")',
    );
  });

  it("requires project creation to claim before charging or enqueueing", () => {
    expect(createRoute).toContain('await import("../services/build-claim.js")');
    expect(createRoute).toContain(
      "await claimProjectBuildStart(id, ctx.user.id)",
    );
    expect(
      createRoute.indexOf("claimProjectBuildStart(id, ctx.user.id)"),
    ).toBeLessThan(
      createRoute.indexOf("await deductCredits(\n            ctx.user.id"),
    );
    expect(createRoute).toContain("releaseProjectBuildClaim(");
    expect(createRoute).toContain("projects-create-refund-");
    expect(createRoute).toContain("await enqueueBuild({");
  });

  it("keeps the normal SSE endpoint from starting or charging builds", () => {
    const ordinaryBuildRoute = streamRoute.split(
      "/** SSE endpoint for Senior Dev Agent",
    )[0];
    expect(ordinaryBuildRoute).not.toContain("claimProjectBuildStart");
    expect(ordinaryBuildRoute).not.toContain("deductCredits(");
    expect(ordinaryBuildRoute).not.toContain("enqueueBuild(");
  });

  it("deduplicates every queue backend and refunds a duplicate paid reservation", () => {
    expect(queue).toContain("jobId: `build-${job.projectId}`");
    expect(queue).toContain("NX: true");
    expect(queue).toContain("memoryQueuedProjects.has(job.projectId)");
    expect(queue).toContain("if (!job.reservationCharged) return");
  });
});
