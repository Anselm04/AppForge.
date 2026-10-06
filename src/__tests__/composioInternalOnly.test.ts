import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

function collectSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = resolve(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry)) out.push(path);
  }
  return out;
}

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Composio is an internal-only capability provider", () => {
  it("does not expose a public tRPC Composio router", () => {
    const routerIndex = source("src/routers/index.ts");
    expect(routerIndex).not.toContain('from "./composio.js"');
    expect(routerIndex).not.toContain("composio: composioRouter");
  });

  it("does not expose direct Composio calls to client code", () => {
    const pageRoot = resolve(process.cwd(), "src/pages");
    const clientSources = collectSourceFiles(pageRoot)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(clientSources).not.toContain("trpc.composio");
    expect(clientSources).not.toContain("composio.searchTools");
    expect(clientSources).not.toMatch(/@composio\/core/);
  });

  it("allows @composio/core only in the dedicated provider module", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const offenders = collectSourceFiles(srcRoot)
      .filter((file) => !file.endsWith(resolve("src/capabilities/providers/composio.ts")))
      .filter((file) => readFileSync(file, "utf8").includes("@composio/core"));

    expect(offenders).toEqual([]);
  });
});
