import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GOLDEN_STACKS,
  goldenCoderRules,
  hardenGeneratedProject,
  isGoldenStack,
  maxFixRetriesForStack,
  stripFilenameHeaders,
} from "../lib/reliableBuild.js";
import { parseGeneratedFiles } from "../services/multiFileCoder.js";
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
} from "../services/stackScaffolds.js";

describe("P0 reliable builds", () => {
  it("preserves executable Node ESM imports in a mixed React and Node artifact", () => {
    const files = hardenGeneratedProject(
      {
        "package.json": JSON.stringify({
          type: "module",
          scripts: { start: "node server/main.js" },
        }),
        "server/main.js":
          'import {answer} from "./value.js";console.log(answer);',
        "server/value.js": "export const answer=42;",
        "src/main.tsx": 'import App from "./App.tsx";',
        "src/App.tsx": "export default function App(){return null;}",
      },
      "react-node",
    );
    const directory = mkdtempSync(join(tmpdir(), "appforge-esm-fixture-"));
    try {
      mkdirSync(join(directory, "server"));
      for (const path of ["package.json", "server/main.js", "server/value.js"])
        writeFileSync(join(directory, path), files[path]);
      expect(
        execFileSync(process.execPath, [join(directory, "server/main.js")], {
          encoding: "utf8",
          timeout: 3000,
        }).trim(),
      ).toBe("42");
      expect(files["server/main.js"]).toContain('from "./value.js"');
      expect(files["src/main.tsx"]).toContain('from "./App"');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("classifies golden stacks", () => {
    expect(isGoldenStack("react-node")).toBe(true);
    expect(isGoldenStack("next-node")).toBe(true);
    expect(isGoldenStack("unity-webgl")).toBe(false);
    expect(GOLDEN_STACKS.length).toBeGreaterThanOrEqual(10);
  });

  it("strips filename headers and fences from bodies", () => {
    const cleaned = stripFilenameHeaders(
      "// filename: src/App.tsx\n```tsx\nexport function App() { return null }\n```\n",
    );
    expect(cleaned).not.toContain("filename:");
    expect(cleaned).not.toContain("```");
    expect(cleaned).toContain("export function App");
  });

  it("parseGeneratedFiles does not leave filename headers in content", () => {
    const files = parseGeneratedFiles(
      `// filename: src/App.tsx\nexport function App() { return <div>Hi</div> }\n// filename: src/main.tsx\nimport { App } from "./App";\n`,
    );
    expect(files["src/App.tsx"]).toBeDefined();
    expect(files["src/App.tsx"]).not.toMatch(/filename:/);
    expect(files["src/main.tsx"]).toContain("import");
  });

  it("hardens incomplete LLM output into a coherent Vite React tree", () => {
    const hardened = hardenGeneratedProject(
      {
        "src/App.tsx":
          "// filename: src/App.tsx\nexport function App() { return <h1>Task app</h1> }",
      },
      "react-node",
    );
    expect(hardened["package.json"]).toBeTruthy();
    expect(
      JSON.parse(hardened["package.json"]).dependencies.react,
    ).toBeTruthy();
    expect(hardened["index.html"]).toContain("root");
    expect(hardened["src/main.tsx"]).toBeTruthy();
    expect(hardened["tsconfig.json"]).toContain("noEmit");
    expect(hardened["src/App.tsx"]).not.toContain("filename:");
  });

  it("react-node scaffold + empty generation hardens to buildable shape", () => {
    const merged = mergeScaffoldWithGenerated(
      getStackScaffold("react-node"),
      {},
    );
    const hardened = hardenGeneratedProject(merged, "react-node");
    const pkg = JSON.parse(hardened["package.json"]);
    expect(pkg.scripts.build).toBeTruthy();
    expect(hardened["src/App.tsx"]).toBeTruthy();
    expect(
      hardened["vite.config.ts"] || hardened["vite.config.js"],
    ).toBeTruthy();
  });

  it("aligns App default/named exports with main.tsx", () => {
    const hardened = hardenGeneratedProject(
      {
        "src/main.tsx": `import App from "./App";\n`,
        "src/App.tsx": `export function App() { return null }\n`,
      },
      "react-node",
    );
    expect(hardened["src/App.tsx"]).toMatch(/export default/);
  });

  it("golden stacks get stricter coder rules and extra fix retries", () => {
    expect(goldenCoderRules("react-node")).toContain("RELIABILITY RULES");
    expect(goldenCoderRules("unity-webgl")).toBe("");
    expect(maxFixRetriesForStack("react-node")).toBe(3);
    expect(maxFixRetriesForStack("flutter-game")).toBe(2);
  });
});
