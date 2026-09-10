import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/services/senior-dev-claim.ts"),
  "utf8",
);
const route = readFileSync(
  resolve(process.cwd(), "src/routes/build.ts"),
  "utf8",
);

describe("Senior Dev execution claims", () => {
  it("atomically claims new or retryable tasks before first execution", () => {
    expect(source).toContain("claimSeniorDevStart");
    expect(source).toContain("STARTABLE_SENIOR_DEV_STATUSES");
    expect(source).toContain(
      "inArray(schema.seniorDevTasks.status, STARTABLE_SENIOR_DEV_STATUSES)",
    );
    expect(source).toContain("releaseSeniorDevStartClaim");
  });

  it("requires the first-run route to claim before charging", () => {
    const claimIndex = route.indexOf(
      "await claimSeniorDevStart(task.id, user.id)",
    );
    const chargeIndex = route.indexOf(
      "await deductCredits(\n        user.id,\n        SENIOR_DEV_BASE_COST",
      claimIndex,
    );
    expect(claimIndex).toBeGreaterThan(-1);
    expect(chargeIndex).toBeGreaterThan(claimIndex);
    expect(route).toContain(
      "releaseSeniorDevStartClaim(task.id, user.id, task.status)",
    );
  });

  it("atomically transitions only awaiting approval tasks on resume", () => {
    expect(source).toContain("claimSeniorDevResume");
    expect(source).toContain(
      'eq(schema.seniorDevTasks.status, "awaiting_approval")',
    );
    expect(source).toContain('status: "executing"');
    expect(source).toContain("return claimed.length === 1");
  });

  it("requires the resume route to acquire the atomic claim before execution", () => {
    expect(route).toContain('from "../services/senior-dev-claim.js"');
    expect(route).toContain("await claimSeniorDevResume(task.id, user.id)");
    expect(route).toContain('error: "senior_dev_task_active"');
  });

  it("derives both failure refunds from the reservation ledger", () => {
    expect(route).toContain(
      'from "../services/senior-dev-reservation.js"',
    );
    expect(route.match(/await refundOutstandingSeniorDevReservation\(/g)).toHaveLength(
      2,
    );
    expect(route).not.toContain("if (!resumeUnlimited)");
    expect(route).not.toContain("senior-dev-resume-refund-${task.id}");
  });
});
