import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("AppForge light theme contract", () => {
  it("uses the premium cool-neutral palette instead of the legacy cream palette", () => {
    expect(css).not.toContain("--forge-bg: #f7f1e5");
    expect(css).not.toContain("--forge-surface: #fffaf0");
    expect(css).toContain("--forge-bg: #f5f7fa");
    expect(css).toContain("--forge-surface: #ffffff");
    expect(css).toContain("--forge-surface-hover: #eef2f6");
  });
});
