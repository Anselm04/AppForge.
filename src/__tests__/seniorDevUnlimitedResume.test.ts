import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/services/seniorDevExecution.ts"),
  "utf8",
);

describe("Senior Dev resume billing entitlement", () => {
  it("does not require a second credit balance after the initial reservation", () => {
    const resumeRoute = source.slice(
      source.indexOf("export async function resumeSeniorDevExecution"),
    );

    expect(resumeRoute).not.toContain("ensureUserCredits(");
    expect(resumeRoute).not.toContain("resumeCredits.balance <");
    expect(resumeRoute).not.toContain("deductCredits(");
    expect(resumeRoute).toContain(
      "await claimSeniorDevResume(task.id, user.id)",
    );
    expect(resumeRoute).toContain(
      "return executeClaimed(input, task, project, true)",
    );
  });
});
