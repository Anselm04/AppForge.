import { describe, expect, it } from "vitest";
import {
  applyPatches,
  ensureIterateGreen,
  hardenAfterIterate,
  selectEditContext,
} from "../lib/iterateReliable.js";
import { assertBuildableShape } from "../lib/reliableBuild.js";
import { buildRecipeApp, classifyRecipe } from "../lib/appRecipes.js";

describe("iterateReliable (Priority 2)", () => {
  it("applyPatches create/modify/delete", () => {
    const base = { "src/App.tsx": "a", "src/old.ts": "x" };
    const next = applyPatches(base, [
      { path: "src/App.tsx", action: "modify", content: "b" },
      { path: "src/new.ts", action: "create", content: "c" },
      { path: "src/old.ts", action: "delete" },
    ]);
    expect(next["src/App.tsx"]).toBe("b");
    expect(next["src/new.ts"]).toBe("c");
    expect(next["src/old.ts"]).toBeUndefined();
  });

  it("hardenAfterIterate keeps buildable shape", () => {
    const recipe = classifyRecipe("todo");
    const files = buildRecipeApp({
      title: "T",
      description: "todo",
      recipe,
    });
    const hardened = hardenAfterIterate(files, "react-node");
    expect(assertBuildableShape(hardened, "react-node")).toEqual([]);
  });

  it("selectEditContext prioritizes App.tsx", () => {
    const ctx = selectEditContext("change the title", {
      "src/App.tsx": "title here",
      "compliance/x.tsx": "no",
      "src/util.ts": "util",
    });
    expect(ctx[0]).toContain("src/App.tsx");
  });

  it("ensureIterateGreen rolls back on persistent failure", async () => {
    const baseline = buildRecipeApp({
      title: "Safe",
      description: "todo list",
      recipe: classifyRecipe("todo"),
    });
    const candidate = {
      ...baseline,
      "src/App.tsx": "export function App() { return <Broken", // invalid
    };
    let calls = 0;
    const outcome = await ensureIterateGreen({
      baseline,
      candidate,
      techStack: "react-node",
      validate: async (files) => {
        calls++;
        const app = files["src/App.tsx"] || "";
        const ok = app.includes("export function App") && !app.includes("<Broken");
        return {
          passed: ok,
          stage: ok ? "build" : "typecheck",
          errors: ok ? [] : ["src/App.tsx: syntax error"],
          durationMs: 1,
        };
      },
      maxFixAttempts: 1,
    });
    expect(outcome.rolledBack).toBe(true);
    expect(outcome.files["src/App.tsx"]).toContain("export function App");
    expect(calls).toBeGreaterThan(0);
  });
});
