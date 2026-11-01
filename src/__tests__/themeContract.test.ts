import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const premiumCss = readFileSync(
  new URL("../premiumTheme.css", import.meta.url),
  "utf8",
);
const entrySource = readFileSync(
  new URL("../main.tsx", import.meta.url),
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
