import { extname, posix } from "node:path";
import ts from "typescript";

export type FileValidationResult = {
  ok: boolean;
  message: string;
};

/** Static editor feedback only. Full execution belongs in the isolated runner. */
export async function validateSingleFile(
  path: string,
  content: string,
  _allFiles: Record<string, string>,
): Promise<FileValidationResult> {
  if (
    !path ||
    path.includes("\0") ||
    path.includes("\\") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path) ||
    posix.normalize(path) !== path ||
    path === ".." ||
    path.startsWith("../")
  ) {
    return {
      ok: false,
      message: "File path must be a canonical relative path.",
    };
  }
  if (Buffer.byteLength(content, "utf8") > 500_000) {
    return { ok: false, message: "File exceeds the editor check size limit." };
  }

  const ext = extname(path).toLowerCase();
  if (ext === ".json") {
    try {
      JSON.parse(content);
      return {
        ok: true,
        message:
          "Valid JSON. This check does not save the file or validate the full build.",
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Invalid JSON",
      };
    }
  }
  if (
    [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"].includes(ext)
  ) {
    const result = ts.transpileModule(content, {
      fileName: path.replace(/\.d\.(ts|mts|cts)$/, ".$1"),
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        allowJs: true,
      },
    });
    const errors = (result.diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (errors.length > 0) {
      return {
        ok: false,
        message: errors
          .slice(0, 3)
          .map((diagnostic) =>
            ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
          )
          .join("; ")
          .slice(0, 400),
      };
    }
    return {
      ok: true,
      message:
        "File syntax check passed. Types, dependencies, tests, and runtime still require full isolated build validation.",
    };
  }
  return {
    ok: true,
    message:
      "No syntax check is available for this file type. Full isolated build validation is required; this check does not save the file.",
  };
}
