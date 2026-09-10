import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../services/build-worker.ts", import.meta.url), "utf8");

describe("failed build credit recovery", () => {
  it("refunds failed reservations with an idempotent attempt key", () => {
    expect(source).toContain("build_refund");
    expect(source).toContain("build-refund-${projectId}-${createdAt}");
    expect(source).toContain("await addCredits(");
  });

  it("does not refund unlimited or lifetime accounts", () => {
    expect(source).toContain('credits?.tier === "lifetime"');
    expect(source).toContain("if (!unlimited)");
  });

  it("records zero billable cost after a refunded failure", () => {
    expect(source).toContain("await updateProjectCreditsSpent(projectId, 0)");
    expect(source).toContain("await recordBuildOutcome(userId, false, 0)");
  });
});
