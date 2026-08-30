import { describe, expect, it } from "vitest";
import { buildGuaranteedGreenApp } from "../lib/guaranteedGreen.js";
import { assertBuildableShape } from "../lib/reliableBuild.js";

describe("guaranteedGreen", () => {
  it("produces a buildable react-node shape", () => {
    const files = buildGuaranteedGreenApp({
      title: "Acme CRM",
      description: "A simple CRM for small teams",
      techStack: "react-node",
    });
    expect(assertBuildableShape(files, "react-node")).toEqual([]);
    expect(files["src/App.tsx"]).toContain("Acme CRM");
    expect(files["package.json"]).toContain("vite");
    const pkg = JSON.parse(files["package.json"]);
    expect(pkg.dependencies.react).toBeTruthy();
    expect(pkg.devDependencies.tailwindcss).toBeTruthy();
  });
});
