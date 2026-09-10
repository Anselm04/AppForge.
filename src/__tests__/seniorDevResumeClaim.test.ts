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

describe("Senior Dev resume claim", () => {
  it("atomically transitions only awaiting approval tasks to executing", () => {
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
});
