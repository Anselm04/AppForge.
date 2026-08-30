import { describe, expect, it } from "vitest";
import {
  classifyRecipe,
  buildRecipeApp,
  checkRecipeSpec,
} from "../lib/appRecipes.js";
import { assertBuildableShape } from "../lib/reliableBuild.js";
import { buildGuaranteedGreenApp } from "../lib/guaranteedGreen.js";

describe("appRecipes", () => {
  it("classifies common prompts", () => {
    expect(classifyRecipe("simple todo list app").id).toBe("todo");
    expect(classifyRecipe("CRM for sales leads").id).toBe("crm");
    expect(classifyRecipe("admin analytics dashboard").id).toBe("dashboard");
    expect(classifyRecipe("login page with email").id).toBe("auth");
    expect(classifyRecipe("SaaS marketing landing page").id).toBe("landing");
  });

  it("builds compile-shaped apps per recipe", () => {
    for (const prompt of [
      "todo app",
      "crm contacts",
      "metrics dashboard",
      "sign in form",
      "settings page",
      "startup landing",
    ]) {
      const recipe = classifyRecipe(prompt);
      const files = buildRecipeApp({
        title: "Test",
        description: prompt,
        recipe,
      });
      expect(assertBuildableShape(files, "react-node")).toEqual([]);
      const spec = checkRecipeSpec(files, recipe);
      expect(spec.ok).toBe(true);
    }
  });

  it("guaranteed green uses recipes", () => {
    const files = buildGuaranteedGreenApp({
      title: "Ship Tasks",
      description: "a todo list for my team",
      techStack: "react-node",
    });
    expect(files["src/App.tsx"]).toMatch(/task|Task|todo|Todo/i);
    expect(assertBuildableShape(files, "react-node")).toEqual([]);
  });
});
