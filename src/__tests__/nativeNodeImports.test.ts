import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { repairNativeNodeImports } from "../lib/nativeNodeImports.js";
import { hardenGeneratedProject } from "../lib/reliableBuild.js";

describe("native Node recovery imports", () => {
  it("does not traverse outside the artifact or hang on an absolute source path", () => {
    const script = `import { repairNativeNodeImports } from "./src/lib/nativeNodeImports.ts";
      const files = {"/outside/main.js": "import './value';", "../outside/main.js": "import './value';"};
      repairNativeNodeImports(files); console.log(JSON.stringify(files));`;
    expect(
      JSON.parse(
        execFileSync(
          process.execPath,
          ["--import", "tsx", "--input-type=module", "-e", script],
          { encoding: "utf8", timeout: 3000 },
        ),
      ),
    ).toEqual({
      "/outside/main.js": "import './value';",
      "../outside/main.js": "import './value';",
    });
  });
  it("preserves ambiguous, missing, explicit and non-module imports", () => {
    const source = `// import "./found";
const example = 'import "./found";';
import "./ambiguous"; import "./missing"; import "./found.js"; import "./found?raw";`;
    const files = {
      "package.json": '{"type":"module"}',
      "server/main.js": source,
      "server/ambiguous.js": "export {};",
      "server/ambiguous.mjs": "export {};",
      "server/found.js": "export {};",
      "legacy/package.json": '{"type":"commonjs"}',
      "legacy/main.js": 'const value = require("../server/found");',
      "src/main.ts": 'import "../server/found";',
    };
    repairNativeNodeImports(files);
    expect(files["server/main.js"]).toBe(source);
    expect(files["legacy/main.js"]).toBe(
      'const value = require("../server/found");',
    );
    expect(files["src/main.ts"]).toBe('import "../server/found";');
  });
  it("repairs mjs without a package manifest and safely escapes file names", () => {
    const files = {
      "main.mjs": "import './quoted\\'name';",
      "quoted'name.js": "export {};",
    };
    repairNativeNodeImports(files);
    expect(files["main.mjs"]).toBe('import "./quoted\'name.js";');
  });
  it("recovers extensionless imports and directory reexports into an executable backend", () => {
    const files = hardenGeneratedProject(
      {
        "package.json": JSON.stringify({
          type: "module",
          scripts: { start: "node server/main.js" },
        }),
        "server/main.js":
          'import "./side"; import { answer } from "./barrel"; const {extra} = await import("./extra"); console.log(answer + extra);',
        "server/side.js": "globalThis.fixtureSideEffect = true;",
        "server/barrel/index.js": 'export { answer } from "../value";',
        "server/value.js": "export const answer = 40;",
        "server/extra.mjs": "export const extra = 2;",
      },
      "react-node",
    );
    const directory = mkdtempSync(join(tmpdir(), "appforge-native-recovery-"));
    try {
      for (const [path, content] of Object.entries(files)) {
        if (path === "package.json" || path.startsWith("server/")) {
          mkdirSync(dirname(join(directory, path)), { recursive: true });
          writeFileSync(join(directory, path), content);
        }
      }
      expect(
        execFileSync(process.execPath, [join(directory, "server/main.js")], {
          encoding: "utf8",
          timeout: 3000,
        }).trim(),
      ).toBe("42");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
