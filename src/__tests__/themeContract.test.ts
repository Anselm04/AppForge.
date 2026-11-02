import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const premiumCss = readFileSync(
  resolve(process.cwd(), "src/premiumTheme.css"),
  "utf8",
);
const entrySource = readFileSync(
  resolve(process.cwd(), "src/main.tsx"),
  "utf8",
);

describe("AppForge light theme contract", () => {
  it("loads a premium cool-neutral palette after the base design system", () => {
    expect(premiumCss).not.toContain("#f7f1e5");
    expect(premiumCss).not.toContain("#fffaf0");
    expect(premiumCss).toContain("--forge-bg: #f5f7fa");
    expect(premiumCss).toContain("--forge-surface: #ffffff");
    expect(premiumCss).toContain("--forge-surface-hover: #eef2f6");
    expect(entrySource.indexOf('import "./premiumTheme.css"')).toBeGreaterThan(
      entrySource.indexOf('import "./index.css"'),
    );
  });
});
