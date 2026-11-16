import { describe, expect, it } from "vitest";
import { appendTaskFlowEvent, buildTaskFlow } from "../lib/livingTaskFlow.js";

describe("live specialist workflow projection", () => {
  it("preserves the state reference for unrelated token events", () => {
    const previous = [
      {
        agent: "Coder",
        type: "task_complete",
        payload: { taskId: "done", filename: "main.ts" },
      },
    ];
    expect(
      appendTaskFlowEvent(previous, { agent: "System", type: "info" }),
    ).toBe(previous);
    expect(
      appendTaskFlowEvent(previous, {
        agent: "Coder",
        type: "chunk",
        payload: { text: "unscoped" },
      }),
    ).toBe(previous);
  });

  it("deduplicates replayed completion events and preserves evidence under pressure", () => {
    const completed = {
      agent: "Coder",
      type: "task_complete",
      payload: { taskId: "task-0", filename: "lib/main.dart" },
    };
    let events = appendTaskFlowEvent([], completed);
    expect(appendTaskFlowEvent(events, completed)).toBe(events);
    for (let i = 1; i <= 560; i++) {
      events = appendTaskFlowEvent(events, {
        agent: "Coder",
        type: "coordination_status",
        payload: { taskId: `task-${i}`, attempt: 1 },
      });
    }
    expect(events.length).toBeLessThanOrEqual(512);
    expect(
      events.some(
        (event) =>
          event.payload?.taskId === "task-0" && event.type === "task_complete",
      ),
    ).toBe(true);
  });

  it("keeps task milestones when code streams hundreds of chunks", () => {
    let events = appendTaskFlowEvent([], {
      agent: "Coder",
      type: "coordination_status",
      payload: { taskId: "task-a", ownerAgent: "Frontend" },
    });
    for (let i = 0; i < 400; i++) {
      events = appendTaskFlowEvent(events, {
        agent: "Coder",
        type: "chunk",
        payload: { taskId: "task-a", text: "source" },
      });
    }
    events = appendTaskFlowEvent(events, {
      agent: "Coder",
      type: "task_complete",
      payload: { taskId: "task-a", filename: "lib/main.dart" },
    });
    expect(events).toHaveLength(3);
    expect(buildTaskFlow(events, "running")[0]).toMatchObject({
      state: "completed",
      filenames: ["lib/main.dart"],
    });
  });

  it("does not invent task boxes without real task identifiers", () => {
    expect(
      buildTaskFlow(
        [{ agent: "Coder", type: "chunk", payload: { text: "unscoped" } }],
        "running",
      ),
    ).toEqual([]);
  });

  it("creates real task nodes and only completes after an explicit task event", () => {
    const activity = [
      {
        agent: "Coder",
        type: "coordination_status",
        payload: {
          taskId: "task-a",
          ownerAgent: "Flutter",
          module: "ui",
          attempt: 1,
        },
      },
      {
        agent: "Coder",
        type: "chunk",
        payload: { taskId: "task-a", text: "source" },
      },
      {
        agent: "Coder",
        type: "coordination_status",
        payload: { taskId: "task-b", ownerAgent: "Backend", module: "api" },
      },
    ];
    const first = buildTaskFlow(activity, "running");
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({
      id: "task-a",
      owner: "Flutter",
      module: "ui",
      state: "running",
    });
    expect(first[1]).toMatchObject({ id: "task-b", state: "running" });
    const completed = buildTaskFlow(
      [
        ...activity,
        {
          agent: "Coder",
          type: "task_complete",
          payload: { taskId: "task-a", filename: "lib/main.dart" },
        },
      ],
      "running",
    );
    expect(completed[0]).toMatchObject({
      state: "completed",
      filenames: ["lib/main.dart"],
    });
    expect(completed[1].state).toBe("running");
  });

  it("renders the actual task plan before execution, without faking activity", () => {
    const planned = [
      {
        id: "front",
        agent: "frontend",
        module: "Mobile screens",
        sequence: 2,
        dependencies: ["back"],
      },
      {
        id: "back",
        agent: "backend",
        module: "Reservation API",
        sequence: 1,
        dependencies: [],
      },
    ];
    const queued = buildTaskFlow([], "running", planned);
    expect(queued.map((node) => node.id)).toEqual(["back", "front"]);
    expect(queued.map((node) => node.state)).toEqual(["queued", "queued"]);
    expect(queued[1].dependencies).toEqual(["back"]);
    const active = buildTaskFlow(
      [
        {
          agent: "Coder",
          type: "coordination_status",
          payload: { taskId: "back", ownerAgent: "backend", dependencies: [] },
        },
      ],
      "running",
      planned,
    );
    expect(active[0].state).toBe("running");
    expect(active[1].state).toBe("queued");
  });

  it("keeps only canonical dependencies received in task-specific activity", () => {
    const logs = [
      {
        agent: "Coder",
        type: "coordination_status",
        payload: { taskId: "backend", ownerAgent: "API", dependencies: [] },
      },
      {
        agent: "Coder",
        type: "coordination_status",
        payload: {
          taskId: "ui",
          ownerAgent: "Frontend",
          dependencies: ["backend", "backend", "ui", ""],
        },
      },
    ];
    const nodes = buildTaskFlow(logs, "running");
    expect(nodes[0].dependencies).toEqual([]);
    expect(nodes[1].dependencies).toEqual(["backend"]);
    expect(nodes[1].state).toBe("running");
  });

  it("turns interrupted activity into paused or failed rather than claiming work is still running", () => {
    const logs = [
      {
        agent: "Coder",
        type: "coordination_status",
        payload: { taskId: "one" },
      },
    ];
    expect(buildTaskFlow(logs, "paused")[0].state).toBe("paused");
    expect(buildTaskFlow(logs, "failed")[0].state).toBe("failed");
    expect(buildTaskFlow(logs, "validated")[0].state).toBe("paused");
  });

  it("shows recorded errors and does not mark a failed task completed", () => {
    const tasks = buildTaskFlow(
      [
        {
          agent: "Coder",
          type: "coordination_status",
          payload: { taskId: "bad", error: "output malformed" },
        },
      ],
      "failed",
    );
    expect(tasks[0]).toMatchObject({
      state: "failed",
      detail: "output malformed",
    });
  });

  it("returns to running when an actual retry event follows a task error", () => {
    const nodes = buildTaskFlow(
      [
        {
          agent: "Coder",
          type: "coordination_status",
          payload: {
            taskId: "retry-task",
            attempt: 1,
            error: "invalid output",
          },
        },
        {
          agent: "Coder",
          type: "coordination_status",
          payload: { taskId: "retry-task", attempt: 2 },
        },
      ],
      "running",
    );
    expect(nodes[0]).toMatchObject({
      id: "retry-task",
      attempt: 2,
      state: "running",
    });
  });

  it("ignores unrelated agent activity and bounds the visible graph", () => {
    const logs = Array.from({ length: 30 }, (_, i) => ({
      agent: "Coder",
      type: "task_complete",
      payload: { taskId: `task-${i}`, filename: `file-${i}.ts` },
    }));
    expect(buildTaskFlow(logs, "running")).toHaveLength(24);
    expect(buildTaskFlow(logs, "running")[0].id).toBe("task-6");
  });
});
