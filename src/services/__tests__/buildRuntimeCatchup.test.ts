import { beforeEach, describe, expect, it, vi } from "vitest";

const getLatestTerminalBuildEvent = vi.fn();

vi.mock("../build-event-store.js", () => ({
  getLatestTerminalBuildEvent,
}));

import {
  clearRuntimeBuild,
  publishRuntimeBuildEvent,
  subscribeRuntimeBuildEvents,
} from "../build-runtime.js";

describe("build runtime subscription catch-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRuntimeBuild(101);
  });

  it("delivers a persisted terminal event missed before subscription", async () => {
    getLatestTerminalBuildEvent.mockResolvedValueOnce({
      id: 9,
      event: "done",
      payload: { status: "completed" },
    });
    const handler = vi.fn();

    const unsubscribe = subscribeRuntimeBuildEvents(101, handler);

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledWith({
        event: "done",
        data: { status: "completed" },
      });
    });
    unsubscribe();
  });

  it("attaches the live listener before the persisted catch-up resolves", async () => {
    let resolveCatchup: (
      value: { id: number; event: string; payload: unknown } | null,
    ) => void = () => undefined;
    getLatestTerminalBuildEvent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCatchup = resolve;
        }),
    );
    const handler = vi.fn();

    const unsubscribe = subscribeRuntimeBuildEvents(101, handler);
    publishRuntimeBuildEvent(101, "progress", { step: 3 });

    expect(handler).toHaveBeenCalledWith({
      event: "progress",
      data: { step: 3 },
    });

    resolveCatchup(null);
    await Promise.resolve();
    unsubscribe();
  });

  it("does not deliver a late catch-up after unsubscribe", async () => {
    let resolveCatchup: (
      value: { id: number; event: string; payload: unknown } | null,
    ) => void = () => undefined;
    getLatestTerminalBuildEvent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCatchup = resolve;
        }),
    );
    const handler = vi.fn();

    const unsubscribe = subscribeRuntimeBuildEvents(101, handler);
    unsubscribe();
    resolveCatchup({ id: 10, event: "error", payload: { error: "build_failed" } });
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).not.toHaveBeenCalled();
  });
});
