import { describe, expect, it } from "vitest";
import { readSseBody } from "../lib/authedSse.js";
import { appendTaskFlowEvent, buildTaskFlow } from "../lib/livingTaskFlow.js";
import { isProjectArtifactReady } from "../lib/buildStatus.js";
import type { BuildLogEntry } from "../lib/buildLogView.js";

/**
 * LOCAL SIMULATION — no provider key, tokens, billing, or real generation.
 * Real SSE frame parsing, task projection and status contracts under test.
 */
const planned = [
  { id: "plan-api", sequence: 1, agent: "backend", module: "Reservation API", dependencies: [] },
  { id: "plan-ui", sequence: 2, agent: "frontend", module: "Flutter screens", dependencies: ["plan-api"] },
  { id: "plan-db", sequence: 3, agent: "database", module: "Reservation storage", dependencies: ["plan-api"] },
];

const taskEvent = (type: string, payload: Record<string, unknown>) =>
  `event: agent\ndata: ${JSON.stringify({ agent: "Coder", type, payload })}\n\n`;

async function replayLocalMockSse(frames: string[]): Promise<BuildLogEntry[]> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(frames.join(""));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Split across frame boundaries to mimic network transport.
      for (let i = 0; i < bytes.length; i += 31) controller.enqueue(bytes.slice(i, i + 31));
      controller.close();
    },
  });
  let activity: BuildLogEntry[] = [];
  await readSseBody(stream, (event, raw) => {
    if (event !== "agent") return;
    const parsed = JSON.parse(raw) as BuildLogEntry;
    activity = appendTaskFlowEvent(activity, parsed);
  });
  return activity;
}

describe("Living Workflow customer journey — local mocked provider, real transport/parser", () => {
  it("moves queued to active to completed across real dependency IDs", async () => {
    expect(buildTaskFlow([], "running", planned).map((node) => node.state)).toEqual(["queued", "queued", "queued"]);
    const logs = await replayLocalMockSse([
      taskEvent("coordination_status", { taskId: "plan-api", ownerAgent: "backend", dependencies: [], attempt: 1 }),
      taskEvent("task_complete", { taskId: "plan-api", filename: "server/routes/bookings.ts" }),
      taskEvent("coordination_status", { taskId: "plan-ui", ownerAgent: "frontend", dependencies: ["plan-api"], attempt: 1 }),
      taskEvent("coordination_status", { taskId: "plan-db", ownerAgent: "database", dependencies: ["plan-api"], attempt: 1 }),
    ]);
    const nodes = buildTaskFlow(logs, "running", planned);
    expect(nodes.map((node) => node.state)).toEqual(["completed", "running", "running"]);
    expect(nodes[1].dependencies).toEqual(["plan-api"]);
    expect(nodes[2].dependencies).toEqual(["plan-api"]);
    expect(nodes[0].filenames).toEqual(["server/routes/bookings.ts"]);
  });

  it("recovers from duplicate SSE replay without duplicating terminal records", async () => {
    const chunks = [
      taskEvent("coordination_status", { taskId: "plan-api", attempt: 1 }),
      taskEvent("task_complete", { taskId: "plan-api", filename: "api.ts" }),
    ];
    const first = await replayLocalMockSse(chunks);
    const replay = await replayLocalMockSse([...chunks, ...chunks]);
    expect(replay).toEqual(first);
    expect(buildTaskFlow(replay, "validated", planned)[0].state).toBe("completed");
  });

  it("reports failure, pause and genuine retry without fabricated success", async () => {
    const events = await replayLocalMockSse([
      taskEvent("coordination_status", { taskId: "plan-api", attempt: 1, error: "Invalid source" }),
    ]);
    expect(buildTaskFlow(events, "failed", planned)[0].state).toBe("failed");
    expect(buildTaskFlow(events, "paused", planned)[1].state).toBe("queued");
    const retried = appendTaskFlowEvent(events, {
      agent: "Coder",
      type: "coordination_status",
      payload: { taskId: "plan-api", attempt: 2 },
    });
    expect(buildTaskFlow(retried, "running", planned)[0].state).toBe("running");
    expect(buildTaskFlow(retried, "running", planned)[1].state).toBe("queued");
  });

  it("never advertises the real preview before an artifact-ready project state", () => {
    expect(isProjectArtifactReady("running")).toBe(false);
    expect(isProjectArtifactReady("failed")).toBe(false);
    expect(isProjectArtifactReady("paused")).toBe(false);
    expect(isProjectArtifactReady("validated")).toBe(true);
  });
});
