import { posix } from "node:path";
import ts from "typescript";

/** Repair native ESM only when one existing artifact target proves the path. */
export function repairNativeNodeImports(files: Record<string, string>): void {
  const isModule = (path: string): boolean => {
    if (path.endsWith(".mjs")) return true;
    if (!path.endsWith(".js")) return false;
    let directory = posix.dirname(path);
    for (;;) {
      const manifest =
        directory === "." ? "package.json" : `${directory}/package.json`;
      if (Object.prototype.hasOwnProperty.call(files, manifest)) {
        try {
          return JSON.parse(files[manifest]).type === "module";
        } catch {
          return false;
        }
      }
      if (directory === ".") return false;
      directory = posix.dirname(directory);
    }
  };
  for (const [path, content] of Object.entries(files)) {
    if (!isModule(path)) continue;
    const source = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const changes: { start: number; end: number; value: string }[] = [];
    const inspect = (literal: ts.Expression | undefined) => {
      if (!literal || !ts.isStringLiteral(literal)) return;
      const specifier = literal.text;
      if (
        !/^(\.\/|\.\.\/)/.test(specifier) ||
        /[?#\\]/.test(specifier) ||
        posix.extname(specifier)
      )
        return;
      const resolved = posix.normalize(
        posix.join(posix.dirname(path), specifier),
      );
      if (
        resolved.startsWith("../") ||
        Object.prototype.hasOwnProperty.call(files, resolved)
      )
        return;
      const candidates = [
        ".js",
        ".mjs",
        ".cjs",
        "/index.js",
        "/index.mjs",
        "/index.cjs",
      ].filter(
        (suffix) =>
          (!specifier.endsWith("/") || suffix.startsWith("/index.")) &&
          Object.prototype.hasOwnProperty.call(
            files,
            posix.normalize(resolved + suffix),
          ),
      );
      if (candidates.length !== 1) return;
      const suffix = candidates[0];
      const replacement = specifier.replace(/\/$/, "") + suffix;
      changes.push({
        start: literal.getStart(source),
        end: literal.end,
        value: JSON.stringify(replacement),
      });
    };
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        inspect(node.moduleSpecifier);
      else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      )
        inspect(node.arguments[0]);
      ts.forEachChild(node, visit);
    };
    visit(source);
    let repaired = content;
    for (const change of changes.sort((a, b) => b.start - a.start))
      repaired =
        repaired.slice(0, change.start) +
        change.value +
        repaired.slice(change.end);
    files[path] = repaired;
  }
}
