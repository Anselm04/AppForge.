import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSseFrame } from "../lib/authedSse.js";

const route = readFileSync(
  resolve(process.cwd(), "src/routes/build.ts"),
  "utf8",
);
const eventStore = readFileSync(
  resolve(process.cwd(), "src/services/build-event-store.ts"),
  "utf8",
);

describe("completed build workflow recovery contract", () => {
  it("checks project ownership before accessing stored task activity", () => {
    const endpoint = route.indexOf('router.get("/:projectId"');
    const ownership = route.indexOf("project.userId !== user.id", endpoint);
    const milestones = route.indexOf(
      "await getBuildTaskMilestones(projectId)",
      endpoint,
    );
    expect(endpoint).toBeGreaterThanOrEqual(0);
    expect(ownership).toBeGreaterThan(endpoint);
    expect(milestones).toBeGreaterThan(ownership);
  });

  it("replays actual milestone events before reporting done, without rerunning a build", () => {
    const start = route.indexOf(
      'if (\n    ["validated", "production-certified"].includes',
    );
    const replay = route.indexOf(
      "await getBuildTaskMilestones(projectId)",
      start,
    );
    const terminal = route.indexOf("event: done", replay);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(replay).toBeGreaterThan(start);
    expect(terminal).toBeGreaterThan(replay);
    expect(route.slice(start, terminal)).not.toContain("runAgentPipeline(");
  });

  it("formats persisted milestone payload as an ordinary parsable agent SSE frame", () => {
    const milestone = {
      agent: "Coder",
      type: "task_complete",
      payload: { taskId: "api", filename: "server/api.ts" },
    };
    const frame = parseSseFrame(
      `event: agent\ndata: ${JSON.stringify(milestone)}\n\n`,
    );
    expect(frame?.event).toBe("agent");
    expect(JSON.parse(frame?.data ?? "{}")).toEqual(milestone);
  });

  it("excludes costly token chunks and previous build claims from replay", () => {
    expect(eventStore).toContain(
      "export async function getBuildTaskMilestones",
    );
    expect(eventStore).toContain("event = 'build_claim'");
    expect(eventStore).toContain("AND event = 'agent'");
    expect(eventStore).toContain("AND payload->>'agent' = 'Coder'");
    expect(eventStore).toContain("'task_complete', 'task_resume_skip'");
    expect(eventStore).toContain("LIMIT 1024");
  });
});
