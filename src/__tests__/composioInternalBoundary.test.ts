import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Composio internal security boundary", () => {
  it("does not expose Composio through the customer-facing app router", () => {
    const appRouter = source("../routers/index.ts");

    expect(appRouter).not.toContain("composioRouter");
    expect(appRouter).not.toMatch(/\bcomposio\s*:\s*/);
  });
});
