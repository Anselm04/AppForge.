import { describe, expect, it } from "vitest";
import { ensureRecipeFloor } from "../appRecipes.js";
import { STACK_ADAPTERS } from "../stackAdapters.js";
import {
  getStackScaffold,
  mergeScaffoldWithGenerated,
  validateStackScaffold,
} from "../../services/stackScaffolds.js";

describe("scaffold system", () => {
  it("provides a valid stack-specific infrastructure scaffold for every adapter", () => {
    for (const adapter of STACK_ADAPTERS) {
      const productType = adapter.productTypes[0];
      const scaffold = getStackScaffold(adapter.id, productType);
      expect(validateStackScaffold(adapter.id, scaffold), adapter.id).toEqual(
        [],
      );
      expect(scaffold[adapter.dependencyManifest]).toBeDefined();
      for (const entrypoint of adapter.entrypoints) {
        expect(
          scaffold[entrypoint],
          `${adapter.id}:${entrypoint}`,
        ).toBeDefined();
      }
      for (const envFile of adapter.environmentFiles) {
        expect(
          Object.prototype.hasOwnProperty.call(scaffold, envFile),
          `${adapter.id}:${envFile}`,
        ).toBe(true);
      }
    }
  });

  it("persists preview, deployment, runtime and output metadata per stack", () => {
    for (const adapter of STACK_ADAPTERS) {
      const scaffold = getStackScaffold(adapter.id, adapter.productTypes[0]);
      const stackMeta = JSON.parse(scaffold["appforge.stack.json"]);
      const previewMeta = JSON.parse(scaffold["appforge.preview.json"]);
      const deployMeta = JSON.parse(scaffold["appforge.deploy.json"]);

      expect(stackMeta.stack).toBe(adapter.id);
      expect(stackMeta.runtime).toBe(adapter.runtime);
      expect(stackMeta.outputDirectory).toBe(adapter.outputDirectory);
      expect(previewMeta.mode).toBe(adapter.previewMode);
      expect(deployMeta.targets).toEqual(adapter.deploymentTargets);
      expect(deployMeta.buildCommand).toBe(adapter.buildCommand);
      expect(deployMeta.startCommand).toBe(adapter.startCommand);
    }
  });

  it("never overwrites substantive generated files during scaffold merge", () => {
    const scaffold = getStackScaffold("react-node", "saas_application");
    const generated = {
      "src/App.tsx":
        'export function App(){ return <main data-product="real">Real product</main>; }',
      "src/main.tsx": 'import { App } from "./App"; console.info(App);',
      "package.json": JSON.stringify({
        name: "customer-product",
        scripts: { build: "customer-build" },
      }),
      "README.md": "# Customer product documentation",
    };

    const merged = mergeScaffoldWithGenerated(
      scaffold,
      generated,
      "react-node",
    );

    expect(merged["src/App.tsx"]).toBe(generated["src/App.tsx"]);
    expect(merged["src/main.tsx"]).toBe(generated["src/main.tsx"]);
    expect(merged["README.md"]).toBe(generated["README.md"]);
    const mergedPackage = JSON.parse(merged["package.json"]);
    expect(mergedPackage.name).toBe("customer-product");
    expect(mergedPackage.scripts.build).toBe("customer-build");
    expect(mergedPackage.scripts.start).toBeDefined();
    expect(mergedPackage.dependencies.react).toBeDefined();
    expect(merged["appforge.stack.json"]).toBeDefined();
  });

  it("cannot use a scaffold to replace missing product implementation", () => {
    const scaffold = getStackScaffold("react-node", "saas_application");
    const merged = mergeScaffoldWithGenerated(
      scaffold,
      {
        "src/App.tsx":
          "export function App(){ return <main>Substantive product</main>; }",
      },
      "react-node",
    );

    expect(merged["src/App.tsx"]).toContain("Substantive product");
    expect(merged["src/main.tsx"]).toBeUndefined();
    expect(merged["package.json"]).toBeDefined();
    expect(merged["vite.config.ts"]).toBeDefined();
  });

  it("does not inject generic React web scaffolds into non-web product families", () => {
    for (const stack of [
      "api-service",
      "ai-agent-node",
      "chrome-extension",
      "flutter-firebase",
      "phaser-html5",
    ]) {
      const adapter = STACK_ADAPTERS.find((item) => item.id === stack)!;
      const scaffold = getStackScaffold(stack, adapter.productTypes[0]);
      expect(scaffold["src/App.tsx"], stack).toBeUndefined();
      if (stack !== "phaser-html5") {
        expect(scaffold["vite.config.ts"], stack).toBeUndefined();
      }
    }

    const api = getStackScaffold("api-service", "api");
    expect(api["src/server.ts"]).toContain("express");
    expect(JSON.parse(api["package.json"]).scripts.start).toBe(
      "node dist/server.js",
    );

    const extension = getStackScaffold("chrome-extension", "browser_extension");
    expect(JSON.parse(extension["manifest.json"]).manifest_version).toBe(3);

    const flutter = getStackScaffold("flutter-firebase", "mobile_app");
    expect(flutter["lib/main.dart"]).toContain("MaterialApp");

    const electron = getStackScaffold("electron-react", "desktop_app");
    expect(electron["electron/main.ts"]).toContain("BrowserWindow");
  });

  it("rejects generic or incompatible stack use for a product type", () => {
    expect(() => getStackScaffold("react-node", "api")).toThrow(
      /does not support product type api/,
    );
    expect(() => getStackScaffold("phaser-html5", "mobile_app")).toThrow(
      /does not support product type mobile_app/,
    );
  });

  it("contains no production placeholder scaffold language", () => {
    for (const adapter of STACK_ADAPTERS) {
      const scaffold = getStackScaffold(adapter.id, adapter.productTypes[0]);
      const text = Object.values(scaffold).join("\n");
      expect(text).not.toMatch(/Scaffold is ready/i);
      expect(text).not.toMatch(/Your generated UI will replace this screen/i);
      expect(text).not.toMatch(/Generated product/i);
      expect(text).not.toMatch(/Coming soon/i);
    }
  });

  it("recipe floors never replace or inject generated product functionality", () => {
    const generated = {
      "src/App.tsx":
        "export function App(){ return <main>Original substantive output</main>; }",
      "src/main.tsx": 'import { App } from "./App"; console.info(App);',
    };
    const result = ensureRecipeFloor(generated, {
      title: "Customer Product",
      description: "CRM dashboard",
    });

    expect(result).toEqual(generated);
    expect(result).not.toBe(generated);

    const missingProduct = ensureRecipeFloor(
      { "package.json": "{}" },
      {
        title: "Customer Product",
        description: "CRM dashboard",
      },
    );
    expect(missingProduct["src/App.tsx"]).toBeUndefined();
  });
});
