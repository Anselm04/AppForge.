import { mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

const processExecution = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("Editor checks must not spawn a host process");
  }),
);
vi.mock("child_process", () => ({
  spawn: processExecution,
  default: { spawn: processExecution },
}));
import { validateSingleFile } from "../lib/validateSingleFile.js";

afterEach(() => vi.clearAllMocks());

describe("editor file checks remain static and confined", () => {
  it("rejects a parent traversal without creating a file outside the workspace", async () => {
    const outside = await mkdtemp(join(tmpdir(), "appforge-file-boundary-"));
    try {
      const result = await validateSingleFile(
        `../${basename(outside)}/escaped.json`,
        "{}",
        {},
      );
      expect(result.ok).toBe(false);
      await expect(
        readFile(join(outside, "escaped.json")),
      ).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
  it("checks valid TypeScript syntax without starting a tool or executing source", async () => {
    const result = await validateSingleFile(
      "src/App.tsx",
      "export const App = () => <div>Hello</div>;",
      { "package.json": "{}", "src/App.tsx": "", "src/broken.ts": "" },
    );
    expect(result).toMatchObject({ ok: true });
    expect(result.message).toMatch(/syntax.*isolated/i);
    expect(processExecution).not.toHaveBeenCalled();
  });
  it("reports a real syntax error statically", async () => {
    const result = await validateSingleFile(
      "src/broken.ts",
      "export const value = ;",
      { "package.json": "{}", "src/App.tsx": "", "src/broken.ts": "" },
    );
    expect(result.ok).toBe(false);
    expect(processExecution).not.toHaveBeenCalled();
  });
  it("does not write unrelated generated files while checking JSON", async () => {
    const outside = await mkdtemp(join(tmpdir(), "appforge-unrelated-file-"));
    try {
      const result = await validateSingleFile("config.json", "{}", {
        [`../${basename(outside)}/unrelated.json`]: "poison",
      });
      expect(result).toMatchObject({ ok: true });
      expect(result.message).not.toMatch(/File saved/i);
      await expect(
        readFile(join(outside, "unrelated.json")),
      ).rejects.toMatchObject({ code: "ENOENT" });
      expect(processExecution).not.toHaveBeenCalled();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
  it("never claims unsupported Python syntax was checked or that a file was saved", async () => {
    const result = await validateSingleFile("main.py", "print('hello')", {});
    expect(result.message).toMatch(/isolated/i);
    expect(result.message).not.toMatch(/syntax OK|saved/i);
    expect(processExecution).not.toHaveBeenCalled();
  });
  it("accepts declaration syntax without trying to emit a declaration file", async () => {
    expect(
      (
        await validateSingleFile(
          "types.d.ts",
          "declare const value: string;",
          {},
        )
      ).ok,
    ).toBe(true);
    expect(
      (await validateSingleFile("types.d.ts", "declare const value = ;", {}))
        .ok,
    ).toBe(false);
    expect(processExecution).not.toHaveBeenCalled();
  });
  it("bounds input before parsing and accepts intentional empty files", async () => {
    expect(
      (await validateSingleFile("src/large.ts", "a".repeat(500_001), {})).ok,
    ).toBe(false);
    expect((await validateSingleFile("src/empty.ts", "", {})).ok).toBe(true);
    expect(processExecution).not.toHaveBeenCalled();
  });
  it.each([
    "/absolute.json",
    "C:/absolute.json",
    "src\\file.json",
    "a\u0000.json",
  ])("rejects noncanonical path %j", async (path) => {
    expect((await validateSingleFile(path, "{}", {})).ok).toBe(false);
  });
});
