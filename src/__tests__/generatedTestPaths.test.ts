import { describe, expect, it, vi } from "vitest";
vi.mock("../_core/llm.js", () => ({ invokeLLM: vi.fn() }));
import { invokeLLM } from "../_core/llm.js";
import { attachGeneratedTests } from "../agents/testingAgent.js";
import { assertSurgicalPatchScope } from "../lib/surgicalFix.js";

describe("generated test artifact paths", () => {
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
