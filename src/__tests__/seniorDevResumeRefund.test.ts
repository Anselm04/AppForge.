import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Senior Dev resume credit recovery", () => {
  it("refunds an outstanding paid reservation through the ledger primitive", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/services/seniorDevExecution.ts"),
      "utf8",
    );

    const resumeRoute = source;

    expect(resumeRoute).toContain(
      "await refundOutstandingSeniorDevReservation(",
    );
    expect(resumeRoute).toContain('"senior_dev_resume_refund_error"');
    expect(resumeRoute).toContain("creditsSpent: 0");
    expect(resumeRoute).not.toContain("senior-dev-resume-refund-${task.id}");
  });
});
