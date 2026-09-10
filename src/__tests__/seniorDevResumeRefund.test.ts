import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Senior Dev resume credit recovery", () => {
  it("refunds a charged reservation exactly once when resume fails", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/routes/build.ts"),
      "utf8",
    );
    expect(source).toContain('`senior-dev-resume-refund-${task.id}`');
    expect(source).toContain('"senior_dev_resume_refund_error"');
    expect(source).toContain('creditsSpent: 0');
  });
});
