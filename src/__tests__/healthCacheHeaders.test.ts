import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/routes/health.ts"),
  "utf8",
);

describe("health endpoint cache safety", () => {
  it("marks all operational health responses as non-cacheable", () => {
    expect(source).toContain("function setNoStoreHeaders(res: Response)");
    expect(source).toContain(
      '"no-store, no-cache, must-revalidate, proxy-revalidate"',
    );

    const liveRoute = source.slice(
      source.indexOf('router.get("/live"'),
      source.indexOf('router.get("/ready"'),
    );
    const readyRoute = source.slice(
      source.indexOf('router.get("/ready"'),
      source.indexOf('router.get("/integrations"'),
    );

    expect(liveRoute).toContain("setNoStoreHeaders(res)");
    expect(readyRoute).toContain("setNoStoreHeaders(res)");
    expect(readyRoute).toContain("SELECT 1");
    expect(readyRoute).toContain("ready: true");
    expect(readyRoute).toContain("ready: false");
  });
});
