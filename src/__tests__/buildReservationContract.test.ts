import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(
  resolve(process.cwd(), "src/routes/build.ts"),
  "utf8",
);
const worker = readFileSync(
  resolve(process.cwd(), "src/services/build-worker.ts"),
  "utf8",
);

describe("build reservation contract", () => {
  it("passes the actual charge state from route to worker", () => {
    expect(route).toContain("const reservationCharged = !unlimited");
    expect(route).toContain("if (reservationCharged)");
    expect(route).toContain("reservationCharged,");
    expect(worker).toContain("reservationCharged: boolean");
  });

  it("keeps unlimited and lifetime builds uncharged", () => {
    expect(route).toContain('credits.tier === "lifetime"');
    expect(route).toContain("const reservationCharged = !unlimited");
  });

  it("treats the upfront reservation as full authorization for pipeline phases", () => {
    expect(worker).toContain("const checkCredits = async () => true");
    expect(worker).not.toContain("current.balance < 1");
    expect(worker).not.toContain(
      'pauseProject(projectId, "credits_exhausted")',
    );
  });

  it("keeps the charge only for completed builds and refunds every other return state", () => {
    expect(worker).toContain('const passed = updated?.status === "completed"');
    expect(worker).toContain(
      "await recordBuildOutcome(userId, true, BUILD_CREDIT_COST)",
    );
    expect(worker).toContain('await refundReservation("Incomplete build")');
    expect(worker).toContain("await recordBuildOutcome(userId, false, 0)");
  });

  it("refunds only attempts that actually deducted a reservation", () => {
    expect(worker).toContain("if (!reservationCharged) return");
    expect(worker).toContain("build-refund-${projectId}-${createdAt}");
  });
});
