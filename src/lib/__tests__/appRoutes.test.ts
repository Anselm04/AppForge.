import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_ROUTES, isKnownAppRoute } from "../appRoutes.js";
import { PLATFORM_FEATURES, featurePath } from "../platformFeatures.js";

const srcDir = resolve(process.cwd(), "src");

/**
 * Only navigational UI is scanned. Code-generation templates under
 * src/services and src/lib legitimately emit routes for the apps AppForge
 * builds, which are not routes of AppForge itself.
 */
const UI_DIRS = ["components", "design-system", "pages"].map((dir) =>
  join(srcDir, dir),
);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...sourceFiles(full));
      continue;
    }
    const ext = extname(entry.name);
    if (ext === ".ts" || ext === ".tsx") out.push(full);
  }
  return out;
}

const appSource = readFileSync(join(srcDir, "App.tsx"), "utf8");
// The `*` catch-all renders the 404 page and is asserted separately.
const declaredRoutes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((path) => path !== "*");

describe("app route table", () => {
  it("keeps App.tsx and the canonical route list in sync", () => {
    expect([...declaredRoutes].sort()).toEqual([...APP_ROUTES].sort());
  });

  it("renders a real 404 for unknown paths instead of redirecting home", () => {
    expect(appSource).toContain('<Route path="*" element={<NotFound />} />');
    expect(appSource).not.toContain('<Route path="*" element={<Navigate');
  });

  it("exposes the routes the marketing surfaces link to", () => {
    for (const route of [
      "/discover",
      "/features/:id",
      "/help",
      "/settings",
      "/shortcuts",
    ]) {
      expect(declaredRoutes).toContain(route);
    }
  });

  it("resolves parameterised and nested paths", () => {
    expect(isKnownAppRoute("/features/orchestrator")).toBe(true);
    expect(isKnownAppRoute("/build/42")).toBe(true);
    expect(isKnownAppRoute("/studio/music")).toBe(true);
    expect(isKnownAppRoute("/pricing?plan=pro")).toBe(true);
    expect(isKnownAppRoute("/onboarding")).toBe(false);
    expect(isKnownAppRoute("/app/health")).toBe(false);
    expect(isKnownAppRoute("https://example.com")).toBe(false);
    expect(isKnownAppRoute(undefined)).toBe(false);
  });

  it("gives every platform feature a reachable detail page", () => {
    for (const feature of PLATFORM_FEATURES) {
      expect(
        isKnownAppRoute(featurePath(feature.id)),
        `${feature.id} feature page must exist`,
      ).toBe(true);
    }
  });
});

describe("internal navigation", () => {
  const linkPattern =
    /(?:to=\{?["`]|navigate\(\s*["`]|href="<?)(\/[a-zA-Z0-9/:$._-]*)/g;

  it("never points at a route that does not exist", () => {
    const broken: string[] = [];

    const files = [
      join(srcDir, "App.tsx"),
      ...UI_DIRS.flatMap((dir) => sourceFiles(dir)),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(linkPattern)) {
        const target = match[1];
        if (!target || target.includes("$")) continue;
        if (target.startsWith("/api")) continue;
        if (isKnownAppRoute(target)) continue;
        broken.push(`${target} (${file.replace(srcDir, "src/")})`);
      }
    }

    expect(broken).toEqual([]);
  });
});
