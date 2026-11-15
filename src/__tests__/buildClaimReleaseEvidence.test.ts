import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const claim = readFileSync("src/services/build-claim.ts", "utf8");
const release = claim.slice(
  claim.indexOf("export async function releaseProjectBuildClaim("),
  claim.indexOf("export async function pauseFailedQueueAttempt("),
);

describe("build admission compensation confirms database outcome", () => {
  it("locks compensation to exactly the expected project owner and running state", () => {
    expect(release).toContain("eq(schema.projects.id, projectId)");
    expect(release).toContain("eq(schema.projects.userId, userId)");
    expect(release).toContain('eq(schema.projects.status, "running")');
  });

  it("never treats a zero-row or unexpected release as a successful rollback", () => {
    expect(release).toContain(".returning({ id: schema.projects.id })");
    expect(release).toContain("if (released.length !== 1)");
    expect(release).toContain("Build claim release was not confirmed");
  });
});
