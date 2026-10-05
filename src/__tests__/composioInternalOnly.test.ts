import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Composio internal-only boundary", () => {
  it("does not register a public Composio tRPC router", () => {
    const routerIndex = source("src/routers/index.ts");

    expect(routerIndex).not.toContain("composioRouter");
    expect(routerIndex).not.toContain("composio: composioRouter");
  });

  it("does not expose direct Composio calls from client surfaces", () => {
    const clientFiles = [
      "src/App.tsx",
      "src/pages/Admin.tsx",
      "src/pages/Account.tsx",
    ];

    for (const path of clientFiles) {
      const content = source(path);
      expect(content).not.toContain("trpc.composio");
      expect(content).not.toContain("composio.searchTools");
      expect(content).not.toContain("@composio/core");
    }
  });
});
