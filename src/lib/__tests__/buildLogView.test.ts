import { describe, expect, it } from "vitest";
import { appendVisibleBuildLog, type BuildLogEntry } from "../buildLogView.js";

describe("live build log display", () => {
  it("keeps a long token stream in one bounded readable row", () => {
    let logs: BuildLogEntry[] = [
      {
        agent: "Planner",
        type: "complete",
        payload: { message: "Approved plan" },
      },
    ];
    for (let i = 0; i < 20000; i++)
      logs = appendVisibleBuildLog(logs, {
        agent: "Coder",
        type: "chunk",
        payload: { text: "abcdefghij" },
      });
    expect(logs).toHaveLength(2);
    expect(logs[0].payload?.message).toBe("Approved plan");
    expect(logs[1].payload?.message).toBe("Streaming output…");
    expect(logs[1].payload?.text?.length).toBeLessThanOrEqual(4096);
  });
  it("preserves milestones and separates agents without mutating earlier snapshots", () => {
    const original: BuildLogEntry[] = [
      { agent: "Coder", type: "chunk", payload: { text: "first" } },
    ];
    const logs = appendVisibleBuildLog(original, {
      agent: "Coder",
      type: "chunk",
      payload: { text: " second" },
    });
    expect(original[0].payload?.text).toBe("first");
    expect(logs[0].payload?.text).toBe("first second");
    const next = appendVisibleBuildLog(logs, {
      agent: "Validator",
      type: "complete",
      payload: { message: "Passed" },
    });
    expect(next).toHaveLength(2);
    expect(
      appendVisibleBuildLog(next, {
        agent: "Research",
        type: "chunk",
        payload: { text: "source" },
      }),
    ).toHaveLength(3);
  });
  it("bounds the display history and retains the newest failure", () => {
    let logs: BuildLogEntry[] = [];
    for (let i = 0; i < 1000; i++)
      logs = appendVisibleBuildLog(logs, {
        agent: "System",
        type: "info",
        payload: { message: `Step ${i}` },
      });
    logs = appendVisibleBuildLog(logs, {
      agent: "System",
      type: "error",
      payload: { message: "Validation failed" },
    });
    expect(logs).toHaveLength(200);
    expect(logs.at(-1)?.payload?.message).toBe("Validation failed");
  });
});
