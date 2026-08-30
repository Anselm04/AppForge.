/**
 * Structural golden suite for Item 1 — no network, no LLM.
 * Simulates incomplete / messy coder output and asserts harden yields a buildable shape.
 */
import { describe, expect, it } from "vitest";
import {
  assertBuildableShape,
  hardenGeneratedProject,
  isGoldenStack,
} from "../lib/reliableBuild.js";
import { parseGeneratedFiles } from "../services/multiFileCoder.js";

const PROMPTS: { name: string; stack: string; llmBlob: string }[] = [
  {
    name: "todo app partial",
    stack: "react-node",
    llmBlob: `// filename: src/App.tsx
export function App() {
  return <main><h1>Todos</h1><ul><li>Ship it</li></ul></main>;
}
`,
  },
  {
    name: "landing with fences",
    stack: "react-node",
    llmBlob: "```tsx src/App.tsx\nexport function App() { return <h1 className=\"text-3xl\">Hello</h1> }\n```\n",
  },
  {
    name: "dashboard multi-file",
    stack: "react-node",
    llmBlob: `// filename: src/App.tsx
import { Stats } from "./Stats";
export function App() { return <Stats />; }
// filename: src/Stats.tsx
export function Stats() { return <div className="p-4 grid gap-4">Stats</div>; }
`,
  },
  {
    name: "next page only",
    stack: "next-node",
    llmBlob: `// filename: app/page.tsx
export default function Page() { return <h1>Next SaaS</h1>; }
`,
  },
  {
    name: "crm shell",
    stack: "react-node",
    llmBlob: `File: src/App.tsx
export default function App() {
  return <div className="flex min-h-screen"><aside>Nav</aside><main>CRM</main></div>;
}
`,
  },
];

describe("Item 1 golden structural suite", () => {
  for (const sample of PROMPTS) {
    it(`${sample.name} (${sample.stack}) hardens to buildable shape`, () => {
      expect(isGoldenStack(sample.stack) || sample.stack.includes("react")).toBe(
        true,
      );
      const parsed = parseGeneratedFiles(sample.llmBlob);
      const problems = assertBuildableShape(parsed, sample.stack);
      expect(problems).toEqual([]);

      const hardened = hardenGeneratedProject(parsed, sample.stack);
      expect(hardened["package.json"]).toBeTruthy();
      const pkg = JSON.parse(hardened["package.json"]);
      expect(pkg.scripts.build).toBeTruthy();
      expect(pkg.dependencies?.react || sample.stack.includes("next")).toBeTruthy();
    });
  }

  it("rejects bogus stub packages in package.json", () => {
    const hardened = hardenGeneratedProject(
      {
        "package.json": JSON.stringify({
          dependencies: { react: "^18.2.0", "html5-game-engine": "stub" },
        }),
        "src/App.tsx": "export function App() { return null }",
      },
      "react-node",
    );
    const pkg = JSON.parse(hardened["package.json"]);
    expect(pkg.dependencies["html5-game-engine"]).toBeUndefined();
  });
});
