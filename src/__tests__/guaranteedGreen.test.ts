import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGuaranteedGreenApp } from "../lib/guaranteedGreen.js";
import { assertBuildableShape } from "../lib/reliableBuild.js";

describe("guaranteedGreen", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses deterministic sample app execution in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      buildGuaranteedGreenApp({
        title: "Customer product",
        description: "Real CRM",
        techStack: "react-node",
      }),
    ).toThrow(/cannot execute in production/);
  });

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
    expect(pkg.devDependencies.vite).toBeTruthy();
    expect(files["tailwind.config.js"]).toBeTruthy();
  });
});
