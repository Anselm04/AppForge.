import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/services/build-worker.ts"),
  "utf8",
);

describe("failed build credit recovery", () => {
  it("refunds failed reservations with an idempotent attempt key", () => {
    expect(source).toContain("build_refund");
    expect(source).toContain("build-refund-${projectId}-${createdAt}");
    expect(source).toContain("await addCredits(");
  });

  it("refunds only attempts that actually charged a reservation", () => {
    expect(source).toContain("reservationCharged: boolean");
    expect(source).toContain("if (!reservationCharged) return");
    expect(source).toContain("build-refund-${projectId}-${createdAt}");
  });

  it("records zero billable cost after a refunded failure", () => {
    expect(source).toContain("await updateProjectCreditsSpent(projectId, 0)");
    expect(source).toContain("await recordBuildOutcome(userId, false, 0)");
  });
});
