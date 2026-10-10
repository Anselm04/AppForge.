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
  it("rejects a Node package with no tests or production build instead of returning green", async () => {
    const result = await validateWithDocker(
      { "package.json": '{"name":"incomplete","scripts":{}}' },
      "react-node",
    );
    expect(result?.passed).toBe(false);
    expect(result?.stage).toBe("docker_contract");
    expect(state.calls.filter((args) => args[0] === "run")).toHaveLength(0);
  });

  it("does not certify Python from syntax-only checks", async () => {
    const result = await validateWithDocker(
      { "main.py": "print('syntax only')", "requirements.txt": "" },
      "python-service",
    );
    expect(result?.passed).toBe(false);
    expect(result?.stage).toBe("isolation");
  });

  it("runs a separate offline runtime probe after Node tests and build", async () => {
    const result = await validateWithDocker(
      {
        "package.json": JSON.stringify({
          name: "checked",
          scripts: {
            test: "node --test",
            build: "node --check app.js",
            start: "node app.js",
          },
        }),
        "app.js": "console.log('fixture')",
      },
      "api-service",
    );
    expect(result?.passed).toBe(true);
    const runs = state.calls.filter((args) => args[0] === "run");
    expect(runs).toHaveLength(3);
    expect(runs[1]).toContain("--network=none");
    expect(runs[1].join(" ")).not.toContain("npm test -- --run");
    expect(runs[2]).toContain("--network=none");
    expect(runs[2].join(" ")).toContain("HTTP response");
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
