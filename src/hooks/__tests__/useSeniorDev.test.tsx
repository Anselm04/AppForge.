import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSeniorDev } from "../useSeniorDev.js";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  approve: vi.fn(),
  consume: vi.fn(),
  read: vi.fn(),
  fresh: vi.fn(),
}));

vi.mock("../../utils/trpc.js", () => ({
  trpc: {
    projects: {
      seniorDev: { mutate: mocks.start },
      seniorDevApprove: { mutate: mocks.approve },
    },
  },
}));
vi.mock("../../lib/auth.js", () => ({
  getAccessToken: () => null,
  browserSessionHeaders: () => ({ "x-appforge-browser-session": "active" }),
  ensureFreshSession: mocks.fresh,
}));
vi.mock("../../lib/csrf.js", () => ({
  withCsrfHeaders: async (headers: HeadersInit) => new Headers(headers),
}));
vi.mock("../../lib/authedSse.js", () => ({
  consumeAuthedSse: mocks.consume,
  readSseBody: mocks.read,
}));

describe("Senior Dev authenticated task actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.start.mockResolvedValue({ taskId: 42 });
    mocks.approve.mockResolvedValue({ success: true });
    mocks.consume.mockResolvedValue(undefined);
    mocks.read.mockResolvedValue(undefined);
    mocks.fresh.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("starts a task through the authenticated tRPC client", async () => {
    const { result } = renderHook(() => useSeniorDev());
    await act(async () => {
      await result.current.startTask(
        7,
        "Build the customer application",
        "autonomous",
      );
    });
    expect(mocks.start).toHaveBeenCalledWith({
      projectId: 7,
      request: "Build the customer application",
      mode: "autonomous",
    });
    expect(mocks.consume).toHaveBeenCalledWith(
      "/api/build/senior/42",
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });

  it("reports interrupted build streams", async () => {
    let finish!: () => void;
    mocks.consume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useSeniorDev());
    await act(async () => {
      await result.current.startTask(
        7,
        "Build a complete application",
        "autonomous",
      );
    });
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      finish();
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.stage).toBe("failed");
    expect(result.current.error).toMatch(/ended before the task/);
  });

  it("handles valid and invalid build completions", async () => {
    const { result } = renderHook(() => useSeniorDev());
    await act(async () => {
      await result.current.startTask(
        7,
        "Build the customer application",
        "autonomous",
      );
    });
    const callback = mocks.consume.mock.calls[0][1] as (
      event: string,
      data: string,
    ) => void;
    act(() => {
      callback(
        "done",
        '{"summary":"Ready","filesChanged":[],"creditsSpent":0}',
      );
    });
    expect(result.current.stage).toBe("completed");
    expect(result.current.result?.summary).toBe("Ready");

    await act(async () => {
      await result.current.startTask(
        7,
        "Build another application",
        "autonomous",
      );
    });
    const secondCallback = mocks.consume.mock.calls[1][1] as (
      event: string,
      data: string,
    ) => void;
    act(() => {
      secondCallback("done", "not-json");
    });
    expect(result.current.stage).toBe("failed");
    expect(result.current.error).toMatch(/invalid completion response/);
    await act(async () => {
      await result.current.startTask(
        7,
        "Build a third application",
        "autonomous",
      );
    });
    const thirdCallback = mocks.consume.mock.calls[2][1] as (
      event: string,
      data: string,
    ) => void;
    act(() => {
      thirdCallback("done", '{"summary":"Not actually complete"}');
    });
    expect(result.current.stage).toBe("failed");
    expect(result.current.result).toBeNull();

  });

  it("resumes approved tasks with the secure cookie session", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("event: done\\ndata: {}\\n\\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const { result } = renderHook(() => useSeniorDev());
    await act(async () => {
      await result.current.startTask(
        7,
        "Build the customer application",
        "collaborative",
      );
    });
    await act(async () => {
      await result.current.approvePlan();
    });
    expect(mocks.approve).toHaveBeenCalledWith({ taskId: 42 });
    expect(mocks.fresh).toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/build/senior/42/resume",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    expect(headers.get("x-appforge-browser-session")).toBe("active");
    expect(headers.has("Authorization")).toBe(false);
    fetcher.mockRestore();
  });
});
