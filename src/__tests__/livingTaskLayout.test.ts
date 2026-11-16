import { describe, expect, it } from "vitest";
import { layoutTaskLayers } from "../lib/livingTaskLayout.js";
import { buildTaskFlow } from "../lib/livingTaskFlow.js";

const planned = [
  {
    id: "ui",
    agent: "frontend",
    module: "Flutter",
    sequence: 4,
    dependencies: ["auth", "api"],
  },
  {
    id: "api",
    agent: "backend",
    module: "Node",
    sequence: 2,
    dependencies: ["db"],
  },
  {
    id: "db",
    agent: "database",
    module: "Postgres",
    sequence: 1,
    dependencies: [],
  },
  {
    id: "auth",
    agent: "security",
    module: "Auth",
    sequence: 3,
    dependencies: ["db"],
  },
];

describe("real dependency-driven visual canvas layout", () => {
  it("places sequential and parallel specialist tasks in correct layers", () => {
    const levels = layoutTaskLayers(buildTaskFlow([], "running", planned));
    expect(levels.map((group) => group.map((task) => task.id))).toEqual([
      ["db"],
      ["api", "auth"],
      ["ui"],
    ]);
    expect(levels.flat().every((task) => task.state === "queued")).toBe(true);
  });

  it("keeps missing references and malformed self-links from breaking layout", () => {
    const tasks = buildTaskFlow([], "running", [
      {
        id: "a",
        agent: "frontend",
        module: "A",
        sequence: 1,
        dependencies: ["missing", "a"],
      },
      {
        id: "b",
        agent: "backend",
        module: "B",
        sequence: 2,
        dependencies: ["a"],
      },
    ]);
    expect(
      layoutTaskLayers(tasks).map((group) => group.map((task) => task.id)),
    ).toEqual([["a"], ["b"]]);
  });

  it("bounds cycle traversal rather than crashing the visualisation", () => {
    const tasks = buildTaskFlow([], "running", [
      {
        id: "a",
        agent: "frontend",
        module: "A",
        sequence: 1,
        dependencies: ["b"],
      },
      {
        id: "b",
        agent: "backend",
        module: "B",
        sequence: 2,
        dependencies: ["a"],
      },
    ]);
    expect(layoutTaskLayers(tasks).flat()).toHaveLength(2);
  });
});
