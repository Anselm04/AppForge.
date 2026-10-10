import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  calls: [] as string[][],
  stall: false,
  started: null as null | (() => void),
}));
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  const spawn = vi.fn((_command: string, args: string[]) => {
    state.calls.push(args);
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(() => true),
    });
    if (args[0] === "run" && state.stall) {
      state.started?.();
      return child;
    }
    queueMicrotask(() => {
      if (args[0] === "version") child.stdout.write("22.0.0");
      child.emit("close", 0);
    });
    return child;
  });
  return { ...actual, spawn, default: { ...actual, spawn } };
});
import { validateWithDocker } from "../lib/dockerValidator.js";
afterEach(() => {
  state.calls = [];
  state.stall = false;
  state.started = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("isolated Docker build lifecycle", () => {
  it("uses different artifact workspaces for builds started in the same millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123456789);
    await validateWithDocker(
      { "main.py": "print('first')", "requirements.txt": "" },
      "python-service",
    );
    await validateWithDocker(
      { "main.py": "print('second')", "requirements.txt": "" },
      "python-service",
    );
    const mounts = state.calls
      .filter((args) => args[0] === "run")
      .map((args) => args[args.indexOf("-v") + 1]);
    expect(new Set(mounts).size).toBe(2);
  });
  it("forcibly removes a timed-out container before returning failure", async () => {
    vi.useFakeTimers();
    state.stall = true;
    let notify!: () => void;
    const started = new Promise<void>((resolve) => {
      notify = resolve;
    });
    state.started = notify;
    const validation = validateWithDocker(
      { "main.py": "print('bounded')", "requirements.txt": "" },
      "python-service",
    );
    await started;
    await vi.advanceTimersByTimeAsync(180_000);
    const result = await validation;
    expect(result?.passed).toBe(false);
    expect(result?.errors.join(" ")).toContain("TIMEOUT");
    const run = state.calls.find((args) => args[0] === "run")!;
    const container = run[run.indexOf("--name") + 1];
    expect(container).toMatch(/^appforge-validation-/);
    expect(state.calls).toContainEqual(["rm", "--force", container]);
  });
});
