import { describe, expect, it } from "vitest";
import {
  ensureRecipeFloor,
  repairSpecWithRecipe,
  classifyRecipe,
  checkRecipeSpec,
  buildRecipeApp,
} from "../lib/appRecipes.js";
import { applyDeterministicErrorFixes } from "../lib/errorFixTable.js";
import {
  stripComplianceFromGolden,
  capGoldenFiles,
} from "../lib/goldenLimits.js";
import { preferReactNodeStack } from "../lib/stackDefaults.js";
import {
  hardenGeneratedProject,
  assertBuildableShape,
} from "../lib/reliableBuild.js";

describe("Item 1 hardening suite", () => {
  it("preferReactNodeStack defaults safely", () => {
    expect(preferReactNodeStack("")).toBe("react-node");
    expect(preferReactNodeStack("auto")).toBe("react-node");
    expect(preferReactNodeStack("next-node")).toBe("next-node");
    expect(preferReactNodeStack("unknown-foo")).toBe("react-node");
  });

  it("stripComplianceFromGolden removes compliance paths", () => {
    const out = stripComplianceFromGolden({
      "src/App.tsx": "export function App(){return null}",
      "compliance/cookie.tsx": "bad",
    });
    expect(out["compliance/cookie.tsx"]).toBeUndefined();
    expect(out["src/App.tsx"]).toBeTruthy();
  });

  it("capGoldenFiles limits sprawl", () => {
    const files: Record<string, string> = {
      "package.json": "{}",
      "src/App.tsx": "app",
      "src/main.tsx": "main",
      "index.html": "html",
    };
    for (let i = 0; i < 20; i++) files[`src/extra${i}.tsx`] = "x".repeat(10 + i);
    const capped = capGoldenFiles(files, 12);
    expect(Object.keys(capped).length).toBeLessThanOrEqual(12);
    expect(capped["src/App.tsx"]).toBeTruthy();
  });

  it("ensureRecipeFloor fills thin App", () => {
    const recipe = classifyRecipe("todo list");
    const out = ensureRecipeFloor(
      { "src/App.tsx": "// TODO" },
      { title: "Tasks", description: "todo list", recipe },
    );
    expect(out["src/App.tsx"].length).toBeGreaterThan(120);
    expect(assertBuildableShape(out, "react-node")).toEqual([]);
  });

  it("repairSpecWithRecipe restores keywords", () => {
    const recipe = classifyRecipe("crm contacts");
    let files = buildRecipeApp({
      title: "CRM",
      description: "crm",
      recipe: classifyRecipe("landing page"),
    });
    // Force wrong shape then repair
    files = repairSpecWithRecipe(files, {
      title: "CRM",
      description: "crm contacts",
      recipe,
    });
    expect(checkRecipeSpec(files, recipe).ok).toBe(true);
  });

  it("deterministic fixes add react import", () => {
    const { files, applied } = applyDeterministicErrorFixes(
      { "src/App.tsx": "export function App(){ return <div/> }" },
      ["error TS2686"],
    );
    expect(files["src/App.tsx"]).toContain("react");
    expect(applied.length).toBeGreaterThan(0);
  });

  it("harden drops bogus packages", () => {
    const hardened = hardenGeneratedProject(
      {
        "package.json": JSON.stringify({
          dependencies: {
            react: "^18.2.0",
            "some-fake-ui-kit": "^1.0.0",
            "html5-game-engine": "stub",
          },
        }),
        "src/App.tsx": "export function App(){return null}",
      },
      "react-node",
    );
    const pkg = JSON.parse(hardened["package.json"]);
    expect(pkg.dependencies["html5-game-engine"]).toBeUndefined();
    // allowlist may drop unknown kits
    expect(pkg.dependencies.react).toBeTruthy();
  });
});
