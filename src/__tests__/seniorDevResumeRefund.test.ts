import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Senior Dev resume credit recovery", () => {
  it("refunds an outstanding paid reservation through the ledger primitive", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/routes/build.ts"),
      "utf8",
    );

    const resumeStart = source.indexOf(
      'router.post("/senior/:taskId/resume"',
    );
    const deployStart = source.indexOf('router.post("/deploy"', resumeStart);
    const resumeRoute = source.slice(resumeStart, deployStart);

    expect(resumeRoute).toContain(
      "await refundOutstandingSeniorDevReservation(",
    );
    expect(resumeRoute).toContain('"senior_dev_resume_refund_error"');
    expect(resumeRoute).toContain("creditsSpent: 0");
    expect(resumeRoute).not.toContain("senior-dev-resume-refund-${task.id}");
  });
});
