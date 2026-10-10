import { describe, expect, it, vi } from "vitest";
vi.mock("../_core/llm.js", () => ({ invokeLLM: vi.fn() }));
import { invokeLLM } from "../_core/llm.js";
import { attachGeneratedTests } from "../agents/testingAgent.js";
import { assertSurgicalPatchScope } from "../lib/surgicalFix.js";

describe("generated test artifact paths", () => {
  it("does not spend model quota writing tests for existing JavaScript or TypeScript tests", async () => {
    vi.mocked(invokeLLM).mockClear();
    const tests = await attachGeneratedTests(
      {
        "server/index.test.js": "export function testHelper() {}",
        "server/model.spec.cjs": "function existingSpec() {}",
        "src/App.test.tsx": "export function existingTest() {}",
        "package.json": "{}",
      },
      "react-node",
    );
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(
      Object.keys(tests).filter((path) => /test\.[cm]?[jt]sx?$/.test(path)),
    ).toEqual([]);
  });

  it("preserves a customer's existing behavioral test on validation retries without another model call", async () => {
    vi.mocked(invokeLLM).mockClear();
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        { message: { content: "// filename: tasks.test.ts\nreplacement" } },
      ],
    } as Awaited<ReturnType<typeof invokeLLM>>);
    const savedTest =
      "// requirement: REQ-001\nimport { it, expect } from 'vitest';\nit('retains edited behavior', () => expect(true).toBe(true));";
    const files = {
      "src/tasks.ts": "export function addTask() { return 'task'; }",
      "src/tasks.test.ts": savedTest,
      "package.json": "{}",
    };
    const additions = await attachGeneratedTests(files, "react-node");
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(additions["src/tasks.test.ts"]).toBeUndefined();
    expect({ ...files, ...additions }["src/tasks.test.ts"]).toBe(savedTest);
  });

  it("generates missing tests even when another module already has a saved test", async () => {
    const mocked = vi.mocked(invokeLLM);
    mocked.mockClear();
    mocked.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "// filename: wrong.test.ts\nimport { it } from 'vitest'; it('new behavior', () => {});",
          },
        },
      ],
    } as Awaited<ReturnType<typeof invokeLLM>>);
    const additions = await attachGeneratedTests(
      {
        "src/saved.ts": "export function saved() {}",
        "src/saved.test.ts":
          "import { it } from 'vitest'; it('saved behavior', () => {});",
        "src/new.ts": "export function newBehavior() {}",
        "package.json": "{}",
      },
      "react-node",
    );
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(additions["src/saved.test.ts"]).toBeUndefined();
    expect(additions["src/new.test.ts"]).toContain(
      "// filename: src/new.test.ts",
    );
  });

  it("saves executable test code when the model wraps its response in Markdown", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "```typescript\n// filename: guessed.test.ts\nimport { it, expect } from 'vitest';\nit('behavior', () => expect(1).toBe(1));\n```",
          },
        },
      ],
    } as Awaited<ReturnType<typeof invokeLLM>>);
    const tests = await attachGeneratedTests(
      { "src/tasks.ts": "export function tasks() {}", "package.json": "{}" },
      "react-node",
    );
    expect(tests["src/tasks.test.ts"]).not.toContain("```");
    expect(tests["src/tasks.test.ts"]).toContain(
      "// filename: src/tasks.test.ts",
    );
    expect(tests["src/tasks.test.ts"]).toContain("it('behavior'");
  });

  it("keeps nested and duplicate basenames beside their exact source regardless of model headers", async () => {
    const mocked = vi.mocked(invokeLLM);
    mocked.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "// filename: TaskForm.test.tsx\nimport { TaskForm } from './TaskForm';\n",
          },
        },
      ],
    } as Awaited<ReturnType<typeof invokeLLM>>);
    const files = {
      "src/components/TaskForm.tsx":
        "export function TaskForm() { return null; }",
      "src/admin/TaskForm.tsx": "export function TaskForm() { return null; }",
      "package.json": "{}",
    };
    const tests = await attachGeneratedTests(files, "react-node");
    expect(tests["TaskForm.test.tsx"]).toBeUndefined();
    for (const path of [
      "src/components/TaskForm.test.tsx",
      "src/admin/TaskForm.test.tsx",
    ]) {
      expect(tests[path]).toContain(`// filename: ${path}`);
      expect(tests[path]).toContain("from './TaskForm'");
      expect(() =>
        assertSurgicalPatchScope(
          { [path]: "repaired test" },
          { ...files, ...tests },
          [],
        ),
      ).not.toThrow();
    }
    expect(
      mocked.mock.calls.slice(-2).map(([args]) => args.messages[0].content),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "exact source path is src/components/TaskForm.tsx",
        ),
        expect.stringContaining("exact source path is src/admin/TaskForm.tsx"),
      ]),
    );
    expect(() =>
      assertSurgicalPatchScope(
        { "src/other/TaskForm.test.tsx": "unowned" },
        { ...files, ...tests },
        [],
      ),
    ).toThrow("outside the approved artifact");
  });
});
