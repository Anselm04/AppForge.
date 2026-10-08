import { describe, expect, it } from "vitest";
import {
  assertSurgicalPatchScope,
  extractErrorPaths,
  mergeSurgicalPatches,
  buildSurgicalFixPrompt,
} from "../lib/surgicalFix.js";

describe("surgicalFix", () => {
  const files = {
    "src/App.tsx": "export function App() { return null }",
    "src/main.tsx": "import { App } from './App'",
    "package.json": "{}",
  };

  it("extracts paths from tsc-style errors", () => {
    const paths = extractErrorPaths(
      ["src/App.tsx(3,1): error TS2304: Cannot find name 'foo'."],
      files,
    );
    expect(paths).toContain("src/App.tsx");
  });

  it("includes the package manifest when a runtime import has no declared dependency", () => {
    const prompt = buildSurgicalFixPrompt({
      appTitle: "Tasks",
      techStack: "react-node",
      errors: ["server/index.js: missing runtime dependency helmet"],
      files: {
        "server/index.js": "import helmet from 'helmet';",
        "package.json": '{"dependencies":{"express":"^4.21.0"}}',
      },
    });
    expect(prompt).toContain("// filename: package.json");
    expect(prompt).toContain('"express":"^4.21.0"');
    expect(prompt).toContain("// filename: server/index.js");
  });

  it("allows existing and approved missing files but rejects scope expansion", () => {
    expect(() =>
      assertSurgicalPatchScope(
        { "package.json": "{}", "server/index.js": "server" },
        files,
        ["server/index.js"],
      ),
    ).not.toThrow();
    expect(() =>
      assertSurgicalPatchScope({ "server/unapproved.js": "server" }, files, []),
    ).toThrow(/outside the approved artifact/);
    expect(() =>
      assertSurgicalPatchScope({ "../escape.ts": "server" }, files, [
        "../escape.ts",
      ]),
    ).toThrow(/outside the approved artifact/);
  });

  it("merges patches without dropping other files", () => {
    const merged = mergeSurgicalPatches(files, {
      "src/App.tsx": "export function App() { return <h1>Hi</h1> }",
    });
    expect(merged["src/main.tsx"]).toBe(files["src/main.tsx"]);
    expect(merged["src/App.tsx"]).toContain("Hi");
  });

  it("buildSurgicalFixPrompt includes errors and file bodies", () => {
    const prompt = buildSurgicalFixPrompt({
      appTitle: "Demo",
      techStack: "react-node",
      errors: ["src/App.tsx(1,1): error TS1234: boom"],
      files,
    });
    expect(prompt).toContain("TS1234");
    expect(prompt).toContain("src/App.tsx");
    expect(prompt).toContain("surgical");
  });
});
