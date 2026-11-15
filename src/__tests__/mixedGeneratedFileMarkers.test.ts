import { describe, expect, it } from "vitest";
import { parseGeneratedFiles } from "../services/multiFileCoder.js";

describe("Bolt.diy action recovery", () => {
  it("recovers executable file actions in order with older marker formats", () => {
    const output = [
      '<boltArtifact id="project" title="Task app">',
      '<boltAction type="file" filePath="src/App.tsx">',
      "export const App = () => <main>Real task list</main>;",
      "</boltAction>",
      '<boltAction type="shell">npm install</boltAction>',
      '<boltAction type="file" filePath="server/src/server.ts">',
      "```typescript",
      "export const handler = () => ({ ok: true });",
      "```",
      "</boltAction>",
      "</boltArtifact>",
      "// filename: README.md",
      "# Real task list",
    ].join("\n");
    const files = parseGeneratedFiles(output);
    expect(Object.keys(files)).toEqual([
      "src/App.tsx",
      "server/src/server.ts",
      "README.md",
    ]);
    expect(files["src/App.tsx"]).toContain("<main>Real task list</main>");
    expect(files["server/src/server.ts"]).toContain("handler");
    expect(JSON.stringify(files)).not.toContain("npm install");
  });

  it("rejects dangerous action paths without leaking action source", () => {
    const output = [
      "// filename: src/safe.ts",
      "export const safe = true;",
      '<boltAction type="file" filePath="../private/secrets.ts">DO_NOT_LEAK</boltAction>',
      '<boltAction type="file" filePath="C:\\\\secrets.ts">ALSO_SECRET</boltAction>',
      '<boltAction type="file" filePath="src/valid.ts">export const valid = 1;</boltAction>',
    ].join("\n");
    const files = parseGeneratedFiles(output);
    expect(Object.keys(files)).toEqual(["src/safe.ts", "src/valid.ts"]);
    expect(files["src/safe.ts"]).not.toContain("DO_NOT_LEAK");
    expect(JSON.stringify(files)).not.toContain("ALSO_SECRET");
  });

  it("preserves filename-looking comments inside a file action", () => {
    const files = parseGeneratedFiles(
      '<boltAction filePath="lib/main.dart" type="file">\n' +
        "// filename: not-a-file.dart\n" +
        "void main() { print('real'); }\n" +
        "</boltAction>",
    );
    expect(Object.keys(files)).toEqual(["lib/main.dart"]);
    expect(files["lib/main.dart"]).toContain("// filename: not-a-file.dart");
  });

  it("does not invent code from incomplete Bolt file actions", () => {
    expect(
      parseGeneratedFiles('<boltAction type="file" filePath="src/App.tsx">unfinished'),
    ).toEqual({});
  });
});

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

  it("keeps Flutter, Node, YAML, SQL and Python files in mixed generator output", () => {
    const files = parseGeneratedFiles(
      [
        "// filename: server/src/server.ts",
        "export const running = true;",
        "### `lib/main.dart`",
        "void main() { print('hello'); }",
        "File: `pubspec.yaml`",
        "name: sample_product",
        "```sql database/migrations/001_init.sql",
        "CREATE TABLE tasks(id integer PRIMARY KEY);",
        "```",
        "```python app/main.py",
        "def main():",
        "    return 'ready'",
        "```",
        "// file: ios/Runner/AppDelegate.swift",
        "import Flutter",
      ].join("\n"),
    );
    expect(Object.keys(files)).toEqual([
      "server/src/server.ts",
      "lib/main.dart",
      "pubspec.yaml",
      "database/migrations/001_init.sql",
      "app/main.py",
      "ios/Runner/AppDelegate.swift",
    ]);
    expect(files["lib/main.dart"]).toContain("void main()");
    expect(files["pubspec.yaml"]).toContain("name: sample_product");
    expect(files["database/migrations/001_init.sql"]).toContain("CREATE TABLE");
    expect(files["app/main.py"]).toContain("    return 'ready'");
    expect(files["ios/Runner/AppDelegate.swift"]).toContain("import Flutter");
  });

  it("rejects unsafe native file paths even when code fenced", () => {
    const files = parseGeneratedFiles(
      "```dart ../secrets.dart\nvoid main() {}\n```\n" +
        "```yaml /etc/config.yaml\nsecret: true\n```\n" +
        "```dart lib/main.dart\nvoid main() {}\n```",
    );
    expect(Object.keys(files)).toEqual(["lib/main.dart"]);
  });

  it("recovers CRLF fenced source files without losing subsequent markers", () => {
    const files = parseGeneratedFiles(
      [
        "```dart lib/main.dart",
        "void main() {",
        "  print('CRLF retained');",
        "}",
        "```",
        "// file: server/src/server.ts",
        "export const running = true;",
        "```yaml pubspec.yaml",
        "name: example",
        "```",
        "",
      ].join("\r\n"),
    );
    expect(Object.keys(files)).toEqual([
      "lib/main.dart",
      "server/src/server.ts",
      "pubspec.yaml",
    ]);
    expect(files["lib/main.dart"]).toContain("  print('CRLF retained');");
    expect(files["server/src/server.ts"]).toContain("running = true");
    expect(files["pubspec.yaml"]).toBe("name: example\r\n");
  });

  it("handles invalid fenced paths without discarding later valid files", () => {
    const files = parseGeneratedFiles(
      "```ts ../unsafe.ts\nbad()\n```\n" +
        "File: src/good.ts\nexport const good = true;\n",
    );
    expect(Object.keys(files)).toEqual(["src/good.ts"]);
  });
});
