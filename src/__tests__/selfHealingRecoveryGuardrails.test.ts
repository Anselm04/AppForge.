import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasEffectiveFileChange } from "../agents/selfHealing.js";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function expectInOrder(text: string, markers: string[]) {
  let previous = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    expect(index, `Missing recovery marker: ${marker}`).toBeGreaterThan(-1);
    expect(index, `Recovery marker out of order: ${marker}`).toBeGreaterThan(previous);
    previous = index;
  }
}

describe("autonomous self-healing recovery guardrails", () => {
  it("detects whether an autonomous repair actually changed project files", () => {
    expect(hasEffectiveFileChange({ "a.ts": "one" }, { "a.ts": "one" })).toBe(false);
    expect(hasEffectiveFileChange({ "a.ts": "one" }, { "a.ts": "two" })).toBe(true);
    expect(hasEffectiveFileChange({ "a.ts": "one" }, { "a.ts": "one", "b.ts": "two" })).toBe(true);
    expect(hasEffectiveFileChange({ "a.ts": "one", "b.ts": "two" }, { "a.ts": "one" })).toBe(true);
  });

  it("hydrates the watchlist from persisted completed projects on every cycle", () => {
    const healing = source("src/agents/selfHealing.ts");
    expect(healing).toContain("export async function hydrateSelfHealingWatchlist");
    expect(healing).toContain('eq(schema.projects.status, "completed")');
    expectInOrder(healing, [
      "export async function runSelfHealingCycle",
      "await hydrateSelfHealingWatchlist();",
      "for (const state of watchedProjects.values())",
    ]);
  });

  it("keeps failed or sub-threshold Sentry issues retryable", () => {
    const healing = source("src/agents/selfHealing.ts");
    expect(healing).toContain("if (totalNewCount < ERROR_SPIKE_THRESHOLD)");
    expect(healing).toContain("if (healed) {");
    expect(healing).toContain("state.lastKnownErrorIds.add(issue.id)");
    expectInOrder(healing, [
      "const healed = await createAutonomousFixTask",
      "if (healed) {",
      "state.lastKnownErrorIds.add(issue.id)",
    ]);
  });

  it("claims recovery globally before autonomous repair", () => {
    const healing = source("src/agents/selfHealing.ts");
    const lock = source("src/services/self-healing-lock.ts");
    expect(healing).toContain("claimSelfHealingProject(state.projectId)");
    expect(healing).toContain("releaseSelfHealingProject(claim)");
    expect(lock).toContain("NX: true");
    expect(lock).toContain("LOCK_TTL_SECONDS");
    expect(lock).toContain("randomUUID()");
    expect(lock).toContain('redis.call("get", KEYS[1]) == ARGV[1]');
  });

  it("uses the existing Senior Dev atomic task claim", () => {
    const healing = source("src/agents/selfHealing.ts");
    expect(healing).toContain("claimSeniorDevStart(taskId, userId)");
  });

  it("deploys and live-verifies the repair before making its snapshot current", () => {
    const healing = source("src/agents/selfHealing.ts");
    expectInOrder(healing, [
      "hasEffectiveFileChange(baselineFiles, result.files)",
      "await deployValidatedProject({",
      "await createBuildSnapshot({",
      "await markSnapshotAsCurrent(newSnapshotId, projectId)",
      'status: "completed"',
    ]);
  });

  it("fails closed when shared Redis coordination is unavailable", () => {
    const healing = source("src/agents/selfHealing.ts");
    expect(healing).toContain("if (!ENV.redisUrl)");
    expect(healing).toContain("self_healing_disabled_no_shared_redis");
  });
});
