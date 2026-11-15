import { describe, expect, it } from "vitest";
import { parseGeneratedFiles } from "../services/multiFileCoder.js";

describe("mixed generated-file boundaries", () => {
  it("collects all supported marker styles in source order", () => {
    const output = [
      "// filename: src/App.tsx",
      "  export const App = () => null;",
      "// file: src/main.ts",
      'import { App } from "./App";',
      "# file: server/api.js",
      "export const ok = true;",
      "### `src/style.css`",
      "body { margin: 0; }",
      "File: `package.json`",
      '{"private":true}',
      "```ts src/extra.ts",
      "export const extra = 1;",
      "```",
    ].join("\n");
    const files = parseGeneratedFiles(output);
    expect(Object.keys(files)).toEqual([
      "src/App.tsx",
      "src/main.ts",
      "server/api.js",
      "src/style.css",
      "package.json",
      "src/extra.ts",
    ]);
    expect(files["src/App.tsx"]).toContain("  export const App");
    expect(files["server/api.js"]).toContain("export const ok");
    expect(files["src/extra.ts"]).toBe("export const extra = 1;\n");
  });

  it("rejects traversal and absolute paths without leaking their contents", () => {
    const files = parseGeneratedFiles(
      "// filename: src/safe.ts\nexport const safe = 1;\n" +
        "// file: ../evil.ts\nexport const evil = 2;\n" +
        "// filename: /absolute.ts\nexport const bad = 3;\n" +
        "# file: C:\\\\secret.ts\nexport const windows = 4;\n" +
        "// filename: src/other.ts\nexport const other = 5;\n",
    );
    expect(Object.keys(files)).toEqual(["src/safe.ts", "src/other.ts"]);
    expect(files["src/safe.ts"]).not.toContain("evil");
    expect(files["src/safe.ts"]).not.toContain("bad");
  });

  it("preserves source comments and indentation inside opaque code fences", () => {
    const files = parseGeneratedFiles(
      "// filename: src/App.tsx\n" +
        "```tsx\n" +
        "  // filename: this-is-a-source-comment\n" +
        "  // an ordinary source comment\n" +
        "  export const result = 42;\n" +
        "```\n" +
        "// file: server/handler.py\n" +
        "    return result\n",
    );
    expect(files["src/App.tsx"]).toContain(
      "  // filename: this-is-a-source-comment",
    );
    expect(files["src/App.tsx"]).toContain("  export const result = 42;");
    expect(files["server/handler.py"]).toBe("    return result\n");
  });

  it("handles invalid fenced paths without discarding later valid files", () => {
    const files = parseGeneratedFiles(
      "```ts ../unsafe.ts\nbad()\n```\n" +
        "File: src/good.ts\nexport const good = true;\n",
    );
    expect(Object.keys(files)).toEqual(["src/good.ts"]);
  });
});
