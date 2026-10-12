import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({
  mount: vi.fn(),
  spawn: vi.fn(),
  teardown: vi.fn(),
  ready: undefined as undefined | ((port: number, url: string) => void),
  boot: vi.fn(),
}));
vi.mock("@webcontainer/api", () => ({ WebContainer: { boot: runtime.boot } }));
import { useWebContainerSandbox } from "../hooks/useWebContainerSandbox.js";
const files = {
  "package.json": '{"scripts":{"dev":"vite"}}',
  "src/main.ts": "export {};",
};
beforeEach(() => {
  vi.clearAllMocks();
  runtime.mount.mockResolvedValue(undefined);
  Object.defineProperty(window, "crossOriginIsolated", {
    configurable: true,
    value: true,
  });
  runtime.boot.mockResolvedValue({
    mount: runtime.mount,
    spawn: runtime.spawn,
    teardown: runtime.teardown,
    on: (_event: string, ready: typeof runtime.ready) => {
      runtime.ready = ready;
      return () => {};
    },
  });
});
describe("existing browser workspace runtime", () => {
  it("forwards the running server URL to the workspace preview", async () => {
    const preview = vi.fn();
    const hook = renderHook(() =>
      useWebContainerSandbox(68, files, vi.fn(), preview),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    act(() => runtime.ready?.(5173, "https://workspace.webcontainer-api.io"));
    expect(preview).toHaveBeenCalledWith(
      "https://workspace.webcontainer-api.io",
    );
    expect(runtime.teardown).not.toHaveBeenCalled();
  });
  it("returns control while a dev server keeps running", async () => {
    runtime.spawn.mockResolvedValue({
      output: { pipeTo: async () => {} },
      exit: new Promise(() => {}),
    });
    const hook = renderHook(() => useWebContainerSandbox(68, files, vi.fn()));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    await expect(hook.result.current.exec("npm run dev")).resolves.toBe(true);
    expect(runtime.spawn).toHaveBeenCalledWith("npm", ["run", "dev"]);
    expect(runtime.teardown).not.toHaveBeenCalled();
  });
  it("keeps one runtime across workspace rerenders and cleans up on leaving the project", async () => {
    const hook = renderHook(
      ({ message }) => useWebContainerSandbox(68, files, message),
      { initialProps: { message: vi.fn() } },
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    hook.rerender({ message: vi.fn() });
    expect(runtime.boot).toHaveBeenCalledOnce();
    expect(runtime.teardown).not.toHaveBeenCalled();
    hook.unmount();
    expect(runtime.teardown).toHaveBeenCalledOnce();
  });
  it("syncs saved source changes without rebooting the workspace", async () => {
    const hook = renderHook(
      ({ source }) => useWebContainerSandbox(68, source, vi.fn()),
      { initialProps: { source: files } },
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    hook.rerender({
      source: { ...files, "src/main.ts": "export const edited = true;" },
    });
    await waitFor(() => expect(runtime.mount).toHaveBeenCalledTimes(2));
    expect(runtime.boot).toHaveBeenCalledOnce();
    expect(
      runtime.mount.mock.calls[1][0].src.directory["main.ts"].file.contents,
    ).toBe("export const edited = true;");
    expect(runtime.teardown).not.toHaveBeenCalled();
  });
  it("disposes a boot that finishes after leaving the project", async () => {
    let finish!: (value: unknown) => void;
    runtime.boot.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const hook = renderHook(() => useWebContainerSandbox(68, files, vi.fn()));
    await waitFor(() => expect(runtime.boot).toHaveBeenCalledOnce());
    hook.unmount();
    await act(async () =>
      finish({ teardown: runtime.teardown, mount: runtime.mount }),
    );
    expect(runtime.teardown).toHaveBeenCalledOnce();
    expect(runtime.mount).not.toHaveBeenCalled();
  });
});
