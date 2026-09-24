import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { templates } from "../data/templates.js";
import { applyDeterministicErrorFixes } from "../lib/errorFixTable.js";
import {
  attachGeneratedTests,
  testHarnessForStack,
} from "../agents/testingAgent.js";
import {
  billingScaffoldFiles,
  billingScaffoldSupported,
} from "../services/saasBillingScaffold.js";
import {
  ensureIterateGreen,
  hardenAfterIterate,
} from "../lib/iterateReliable.js";
import {
  buildGuaranteedGreenApp,
  stackRecipeCoderHint,
} from "../lib/guaranteedGreen.js";
import { resolveIntakeContract } from "../lib/productContract.js";
import { resolveProjectStack } from "../lib/projectStack.js";
import {
  appliesGoldenWebLimits,
  assertBuildableShape,
  complianceScaffoldingAllowed,
  goldenCoderRules,
  hardenGeneratedProject,
  hardeningProfileForStack,
} from "../lib/reliableBuild.js";
import { validateRuntimeImplementation } from "../lib/runtimeArchitecture.js";
import { assertProductQuality } from "../lib/neverGiveUp.js";
import { STACK_ADAPTERS, normalizeStackId } from "../lib/stackAdapters.js";
import { detectStackFromFiles } from "../lib/stackDetection.js";
import {
  buildDeploymentDecision,
  manualDeployPreflight,
  productionPlanForStack,
} from "../lib/stackDeployment.js";
import {
  completedBuildUrl,
  stackPresentation,
} from "../lib/stackPresentation.js";
import { templateIntake } from "../routers/templates.js";
import { injectComplianceScaffolding } from "../services/compliance-template.js";
import { getStackScaffold } from "../services/stackScaffolds.js";

const REACT_TOOLCHAIN = ["react-dom", "vite", "@vitejs/plugin-react"];

function deps(files: Record<string, string>): Record<string, string> {
  const pkg = JSON.parse(files["package.json"] ?? "{}") as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

describe("section 4: contract-driven stack selection", () => {
  it("selects the stack from the canonical product contract when none is chosen", () => {
    const cases: Array<[string, string]> = [
      [
        "Build a 2D platformer game with levels and a boss fight",
        "phaser-html5",
      ],
      [
        "Build an iOS and Android mobile app for tracking habits",
        "react-native-expo",
      ],
      [
        "Build a REST API for managing invoices with authentication",
        "api-service",
      ],
      [
        "Build a Chrome extension that summarizes the current tab",
        "chrome-extension",
      ],
    ];
    for (const [prompt, stack] of cases) {
      const intake = resolveIntakeContract(prompt, "auto");
      expect(intake.ok, prompt).toBe(true);
      if (intake.ok) {
        expect(intake.productContract.selectedTechnologyStack, prompt).toBe(
          stack,
        );
      }
    }
  });

  it("preserves an explicit compatible user stack instead of the default", () => {
    const api = resolveIntakeContract(
      "Build a REST API for managing invoices with authentication",
      "python-service",
    );
    expect(api.ok && api.productContract.selectedTechnologyStack).toBe(
      "python-service",
    );
    const game = resolveIntakeContract(
      "Build a 2D platformer game with levels and a boss fight",
      "three",
    );
    expect(game.ok && game.productContract.selectedTechnologyStack).toBe(
      "three-js-3d",
    );
  });

  it("rejects an incompatible explicit stack rather than silently replacing it", () => {
    const intake = resolveIntakeContract(
      "Build a 2D platformer game with levels and a boss fight",
      "react-node",
    );
    expect(intake.ok).toBe(false);
    if (!intake.ok) expect(intake.reason).toBe("unsupported_stack");
  });

  it("maps the 'node service' alias to the Node service adapter", () => {
    expect(normalizeStackId("node service")).toBe("node-service");
    expect(normalizeStackId("node api")).toBe("api-service");
  });
});

describe("section 4: no silent React conversion", () => {
  const nonReactStacks = STACK_ADAPTERS.filter(
    (adapter) =>
      hardeningProfileForStack(adapter.id) !== "vite-react" &&
      hardeningProfileForStack(adapter.id) !== "next",
  ).map((adapter) => adapter.id);

  it("hardening never adds React, Vite or a package.json to non-React stacks", () => {
    expect(nonReactStacks).toEqual(
      expect.arrayContaining([
        "static-html",
        "phaser-html5",
        "three-js-3d",
        "react-native-expo",
        "flutter-firebase",
        "api-service",
        "node-service",
        "python-service",
        "ai-agent-node",
        "ai-agent-python",
        "chrome-extension",
        "browser-automation",
      ]),
    );
    for (const stack of nonReactStacks) {
      const scaffold = getStackScaffold(stack);
      const hardened = hardenGeneratedProject({ ...scaffold }, stack);
      expect(Boolean(hardened["package.json"]), stack).toBe(
        Boolean(scaffold["package.json"]),
      );
      for (const name of REACT_TOOLCHAIN) {
        if (stack === "phaser-html5" || stack === "three-js-3d") {
          if (name === "vite") continue;
        }
        expect(deps(hardened)[name], `${stack} gained ${name}`).toBe(
          deps(scaffold)[name],
        );
      }
      expect(hardened["src/App.tsx"], stack).toBe(scaffold["src/App.tsx"]);
      expect(hardened["src/main.tsx"], stack).toBe(scaffold["src/main.tsx"]);
      if (!scaffold["tsconfig.json"])
        expect(hardened["tsconfig.json"], stack).toBeUndefined();
    }
  });

  it("keeps real stack dependencies and NodeNext import extensions", () => {
    const api = hardenGeneratedProject(
      getStackScaffold("api-service"),
      "api-service",
    );
    expect(deps(api).helmet).toBeTruthy();
    expect(deps(api)["express-rate-limit"]).toBeTruthy();
    const automation = hardenGeneratedProject(
      getStackScaffold("browser-automation"),
      "browser-automation",
    );
    expect(deps(automation).playwright).toBe("1.59.1");
    const agent = hardenGeneratedProject(
      getStackScaffold("ai-agent-node"),
      "ai-agent-node",
    );
    expect(agent["src/index.ts"]).toContain('from "./agent.js"');
    const python = hardenGeneratedProject(
      getStackScaffold("python-service"),
      "python-service",
    );
    expect(python["package.json"]).toBeUndefined();
    expect(python[".gitignore"]).toContain("__pycache__/");
  });

  it("drops only bogus packages, never real ones", () => {
    const hardened = hardenGeneratedProject(
      {
        "package.json": JSON.stringify({
          dependencies: {
            fastify: "^5.0.0",
            "ai-agent-sdk": "1.0.0",
            pino: "stub",
          },
        }),
        "src/index.ts": "export {};\n",
      },
      "node-service",
    );
    expect(deps(hardened)).toEqual({ fastify: "^5.0.0" });
  });

  it("rejects unknown stacks instead of treating them as React", () => {
    expect(() => hardenGeneratedProject({}, "vue-node")).toThrow(
      /Unsupported technology stack/,
    );
    expect(() => hardenAfterIterate({}, "")).toThrow(
      /technology stack is required/,
    );
  });

  it("keeps React hardening for React stacks", () => {
    const hardened = hardenGeneratedProject(
      { "src/App.tsx": "export function App(){return <h1>x</h1>}" },
      "react-node",
    );
    expect(deps(hardened).react).toBeTruthy();
    expect(hardened["src/main.tsx"]).toBeTruthy();
    expect(assertBuildableShape(hardened, "react-node")).toEqual([]);
  });

  it("post-edit hardening does not trim or convert mobile, desktop or service projects", () => {
    const expo = getStackScaffold("react-native-expo");
    const extra: Record<string, string> = {};
    for (let i = 0; i < 20; i++)
      extra[`src/screens/Screen${i}.tsx`] = `export const S${i} = ${i};\n`;
    const out = hardenAfterIterate({ ...expo, ...extra }, "react-native-expo");
    expect(Object.keys(out).length).toBeGreaterThanOrEqual(
      Object.keys(expo).length + 20,
    );
    expect(out["vite.config.ts"]).toBeUndefined();
    expect(out["index.html"]).toBeUndefined();
    expect(appliesGoldenWebLimits("react-native-expo")).toBe(false);
    expect(appliesGoldenWebLimits("electron-react")).toBe(false);
    expect(appliesGoldenWebLimits("react-node")).toBe(true);
  });

  it("ensureIterateGreen requires the project's stack", async () => {
    await expect(
      ensureIterateGreen({
        baseline: {},
        candidate: {},
        techStack: "",
        validate: async () => ({
          passed: true,
          stage: "build",
          errors: [],
          durationMs: 0,
          fileCount: 0,
          warning: "",
        }),
      }),
    ).rejects.toThrow(/technology stack is required/);
  });

  it("gives each stack its own coder rules and React recipes only to React stacks", () => {
    expect(goldenCoderRules("phaser-html5")).toContain("Do NOT use React");
    expect(goldenCoderRules("python-service")).toContain(
      "Do NOT convert this project to React",
    );
    expect(goldenCoderRules("python-service")).not.toContain("React 18");
    expect(goldenCoderRules("next-node")).toContain("App Router");
    expect(goldenCoderRules("react-node")).toContain("React 18");
    expect(stackRecipeCoderHint("a todo list app", "phaser-html5")).toBe("");
    expect(stackRecipeCoderHint("a todo list app", "api-service")).toBe("");
    expect(stackRecipeCoderHint("a todo list app", "react-node")).toContain(
      "RECIPE:",
    );
  });

  it("never substitutes a React recipe app for another stack", () => {
    expect(() =>
      buildGuaranteedGreenApp({
        title: "G",
        description: "game",
        techStack: "phaser-html5",
      }),
    ).toThrow(/only exist for React \+ Vite stacks/);
  });

  it("adds compliance boilerplate only to Node services and never the React banner", () => {
    expect(complianceScaffoldingAllowed("api-service")).toBe(true);
    expect(complianceScaffoldingAllowed("python-service")).toBe(false);
    expect(complianceScaffoldingAllowed("flutter-firebase")).toBe(false);
    expect(complianceScaffoldingAllowed("static-html")).toBe(false);
    const files: Record<string, string> = {};
    injectComplianceScaffolding(files, { reactComponents: false });
    expect(Object.keys(files).some((path) => path.endsWith(".tsx"))).toBe(
      false,
    );
    expect(files["compliance/audit-logger.ts"]).toBeTruthy();
  });

  it("has no silent react-node fallbacks left in application source", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === "__tests__" || entry === "node_modules") continue;
          walk(full);
        } else if (/\.(ts|tsx|txt)$/.test(entry) && !entry.includes(".test.")) {
          const text = readFileSync(full, "utf8");
          if (/(\?\?|\|\|)\s*["']react-node["']/.test(text))
            offenders.push(full);
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});

describe("section 4: existing projects keep their stack", () => {
  it("uses the contract stack, then the recorded stack, and never defaults", () => {
    const intake = resolveIntakeContract(
      "Build a 2D platformer game with levels and a boss fight",
      "auto",
    );
    if (!intake.ok) throw new Error("expected contract");
    expect(
      resolveProjectStack({
        techStack: "react-node",
        productContract: intake.productContract,
      }).techStack,
    ).toBe("phaser-html5");
    expect(resolveProjectStack({ techStack: "Flutter" }).techStack).toBe(
      "flutter-firebase",
    );
    expect(() => resolveProjectStack({ techStack: null })).toThrow(
      /technology stack is required/,
    );
    expect(() => resolveProjectStack(null)).toThrow(
      /technology stack is required/,
    );
  });

  it("detects imported GitHub repository stacks instead of assuming React", () => {
    const pkg = (
      deps: Record<string, string>,
      extra: Record<string, unknown> = {},
    ) => JSON.stringify({ dependencies: deps, ...extra });
    const cases: Array<[Record<string, string>, string]> = [
      [{ "pubspec.yaml": "name: x" }, "flutter-firebase"],
      [
        {
          "src-tauri/tauri.conf.json": "{}",
          "package.json": pkg({ react: "18" }),
        },
        "tauri-rust",
      ],
      [
        { "manifest.json": JSON.stringify({ manifest_version: 3 }) },
        "chrome-extension",
      ],
      [
        { "package.json": pkg({ expo: "52", "react-native": "0.76" }) },
        "react-native-expo",
      ],
      [
        { "package.json": pkg({ electron: "33", react: "18" }) },
        "electron-react",
      ],
      [{ "package.json": pkg({ next: "14", react: "18" }) }, "next-node"],
      [{ "package.json": pkg({ phaser: "3" }) }, "phaser-html5"],
      [{ "package.json": pkg({ three: "0.169" }) }, "three-js-3d"],
      [{ "package.json": pkg({ playwright: "1.59.1" }) }, "browser-automation"],
      [
        { "package.json": pkg({ react: "18", recharts: "2" }) },
        "data-visualization",
      ],
      [{ "package.json": pkg({ react: "18" }) }, "react-node"],
      [{ "package.json": pkg({ openai: "4", express: "5" }) }, "ai-agent-node"],
      [{ "package.json": pkg({ express: "5" }) }, "api-service"],
      [{ "package.json": pkg({}, { main: "index.js" }) }, "node-service"],
      [{ "requirements.txt": "fastapi\nuvicorn\n" }, "python-service"],
      [{ "pyproject.toml": 'dependencies = ["openai>=1"]' }, "ai-agent-python"],
      [{ "index.html": "<main></main>" }, "static-html"],
    ];
    for (const [files, stack] of cases) {
      const detected = detectStackFromFiles(files);
      expect(detected.ok && detected.stack, JSON.stringify(files)).toBe(stack);
    }
    expect(detectStackFromFiles({ "main.go": "package main" }).ok).toBe(false);
    expect(detectStackFromFiles({ "package.json": "{}" }).ok).toBe(false);
  });

  it("creates template projects with an explicit contract on the template's stack", () => {
    expect(templates.find((t) => t.id === "template-5")?.stackId).toBe(
      "data-visualization",
    );
    for (const template of templates) {
      const intake = templateIntake(template);
      expect(intake.ok, template.id).toBe(true);
      if (intake.ok) {
        expect(intake.productContract.selectedTechnologyStack).toBe(
          template.stackId,
        );
        expect(() =>
          getStackScaffold(
            intake.productContract.selectedTechnologyStack,
            intake.productContract.productType,
          ),
        ).not.toThrow();
      }
    }
    const broken = { ...templates[0], stackId: "cobol" };
    expect(templateIntake(broken)).toMatchObject({ ok: false });
  });
});

describe("section 4: stack adapters are real per stack", () => {
  it("ships non-empty environment files and stack-appropriate manifests", () => {
    for (const adapter of STACK_ADAPTERS) {
      const scaffold = getStackScaffold(adapter.id, adapter.productTypes[0]);
      for (const envFile of adapter.environmentFiles) {
        expect(
          scaffold[envFile]?.trim(),
          `${adapter.id} ${envFile}`,
        ).toBeTruthy();
      }
      expect(scaffold[adapter.dependencyManifest], adapter.id).toBeTruthy();
      if (adapter.buildCommand === "npm run build") {
        expect(
          JSON.parse(scaffold["package.json"]).scripts.build,
          adapter.id,
        ).toBeTruthy();
      }
      expect(JSON.parse(scaffold["appforge.stack.json"]).stack).toBe(
        adapter.id,
      );
    }
  });

  it("gives agent, automation and API stacks distinct runtime code and env", () => {
    const agent = getStackScaffold("ai-agent-node");
    expect(agent["src/agent.ts"]).toContain("/chat/completions");
    expect(agent["src/index.ts"]).toContain('app.post("/agent/run"');
    expect(agent[".env.example"]).toContain("OPENAI_API_KEY=");
    const pyAgent = getStackScaffold("ai-agent-python");
    expect(pyAgent["app/agent.py"]).toContain("async def run_agent");
    expect(pyAgent["requirements.txt"]).toContain("httpx");
    const automation = getStackScaffold("browser-automation");
    expect(automation["src/automation.ts"]).toContain('from "playwright"');
    expect(automation[".env.example"]).toContain("AUTOMATION_ALLOWED_HOSTS=");
    const api = getStackScaffold("api-service");
    expect(api["src/server.ts"]).toBeTruthy();
    expect(api[".env.example"]).toContain("CORS_ORIGIN=");
    const extension = getStackScaffold("chrome-extension");
    expect(JSON.parse(extension["package.json"]).scripts.build).toBe(
      "tsc -p tsconfig.json",
    );
    expect(JSON.parse(extension["tsconfig.json"]).compilerOptions.outDir).toBe(
      "dist",
    );
  });

  it("requires Node services to serve the deploy-time build identity", () => {
    expect(
      validateRuntimeImplementation(
        getStackScaffold("api-service"),
        "api-service",
      ),
    ).toEqual([]);
    const withoutIdentity = {
      "src/server.ts":
        'const port = process.env.PORT; app.get("/health/live"); app.get("/health/ready"); process.on("SIGTERM"); process.on("SIGINT"); server.close();',
    };
    expect(
      validateRuntimeImplementation(withoutIdentity, "api-service"),
    ).toContain(
      "node service must serve the production build identity at /.well-known/appforge-build.json",
    );
  });

  it("packages and verifies each runnable stack for its runtime", () => {
    expect(productionPlanForStack("api-service", {}).verification).toBe(
      "http_health",
    );
    expect(productionPlanForStack("api-service", {}).healthPaths).toEqual([
      "/health/live",
      "/health/ready",
    ]);
    expect(productionPlanForStack("react-node", {}).verification).toBe(
      "browser",
    );
    expect(productionPlanForStack("static-html", {}).dockerfile).toContain(
      "nginx",
    );
    for (const adapter of STACK_ADAPTERS) {
      if (adapter.generationMode === "runnable") {
        expect(
          () => productionPlanForStack(adapter.id, {}),
          adapter.id,
        ).not.toThrow();
      }
    }
  });
});

describe("section 4: structural-only stacks are never presented as deployed", () => {
  const structural = STACK_ADAPTERS.filter(
    (a) => a.generationMode === "structural",
  ).map((a) => a.id);

  it("skips production deployment and live URLs for structural stacks", () => {
    expect(structural).toEqual(
      expect.arrayContaining([
        "react-native-expo",
        "flutter-firebase",
        "electron-react",
        "tauri-rust",
        "python-service",
        "ai-agent-python",
        "chrome-extension",
      ]),
    );
    for (const stack of structural) {
      expect(buildDeploymentDecision(stack, "production")).toEqual({
        action: "skip",
        deployment: "structural_source_only",
      });
      expect(() => productionPlanForStack(stack, {})).toThrow(
        /Structural-only stack/,
      );
      const presentation = stackPresentation(stack);
      expect(presentation?.structuralOnly).toBe(true);
      expect(presentation?.deployDestinations).toEqual([]);
      expect(presentation?.badge).toContain("not deployed");
      expect(
        completedBuildUrl({
          liveUrl: "https://x.fly.dev/",
          projectId: 1,
          structuralOnly: true,
        }),
      ).toBeNull();
    }
    expect(buildDeploymentDecision("react-node", "production")).toEqual({
      action: "deploy",
    });
    expect(buildDeploymentDecision("react-node", "development")).toEqual({
      action: "skip",
      deployment: "not_production",
    });
    expect(
      completedBuildUrl({ liveUrl: null, projectId: 7, structuralOnly: false }),
    ).toBe("/apps/7");
  });

  it("marks structural builds in the build worker done event and the UI", () => {
    const worker = readFileSync("src/services/build-worker.ts", "utf8");
    expect(worker).toContain("buildDeploymentDecision(");
    expect(worker).toContain(
      'structuralOnly: stackAdapter.generationMode === "structural"',
    );
    const build = readFileSync("src/pages/Build.tsx", "utf8");
    expect(build).toContain("structural-stack-badge");
    expect(build).toContain("Source generation complete (not deployed)");
    const wizard = readFileSync("src/components/DeployWizard.tsx", "utf8");
    expect(wizard).toContain("deployUrl && !structuralNotice");
  });
});

describe("section 4: self-heal and chat edits stay on the project stack", () => {
  it("deterministic self-heal fixes never add React or break NodeNext imports", () => {
    const service = {
      "package.json": JSON.stringify({ dependencies: { express: "^4.21.2" } }),
      "src/server.ts": 'import { tools } from "./tools.js";\nexport {};\n',
      "src/view.tsx": "export const View = () => <div />;\n",
    };
    const { files } = applyDeterministicErrorFixes(service, ["error TS2307"]);
    expect(files["src/server.ts"]).toContain('from "./tools.js"');
    expect(files["src/view.tsx"]).not.toContain("react");

    const reactApp = {
      "package.json": JSON.stringify({ dependencies: { react: "^18.2.0" } }),
      "src/App.tsx":
        'import { X } from "./X.tsx";\nexport const App = () => <X />;\n',
    };
    const fixed = applyDeterministicErrorFixes(reactApp, ["error TS2307"]);
    expect(fixed.files["src/App.tsx"]).toContain('from "./X"');
    expect(fixed.files["src/App.tsx"]).toContain('from "react"');
  });

  it("builds the Quick Edit prompt from the project's stack adapter", () => {
    const quickEdit = readFileSync("src/services/quickEditAgent.ts", "utf8");
    expect(quickEdit).toContain("quickEditSystemPrompt(techStack)");
    expect(quickEdit).not.toContain("React 18, TypeScript, Tailwind");
    expect(quickEdit).toContain("adapter.entrypoints");
  });

  it("refuses to run the pipeline on a stack other than the contract's", () => {
    const part0 = readFileSync("src/agents/.pipeline_parts/part0.txt", "utf8");
    expect(part0).toContain(
      "if (productContract.selectedTechnologyStack !== techStack) {",
    );
  });

  it("clones a template project with the source stack and contract", () => {
    const factory = readFileSync("src/routers/templateFactory.ts", "utf8");
    expect(factory).toContain(
      "const sourceStack = resolveProjectStack(source)",
    );
    expect(factory).toContain("productContract: sourceStack.productContract");
  });
});

describe("section 4: generated tests and billing never add React to other stacks", () => {
  it("picks the test harness from the stack adapter", () => {
    expect(testHarnessForStack("react-node")).toBe("react");
    expect(testHarnessForStack("next-node")).toBe("react");
    expect(testHarnessForStack("data-visualization")).toBe("react");
    for (const stack of ["phaser-html5", "three-js-3d", "static-html"]) {
      expect(testHarnessForStack(stack)).toBe("dom");
    }
    for (const stack of [
      "api-service",
      "node-service",
      "ai-agent-node",
      "browser-automation",
    ]) {
      expect(testHarnessForStack(stack)).toBe("node");
    }
  });

  it("attaches a React-free test harness to services and games", async () => {
    const service: Record<string, string> = {
      "package.json": JSON.stringify({ dependencies: { express: "^4.21.2" } }),
      "src/boot.ts": "console.log('boot');\n",
    };
    const serviceTests = await attachGeneratedTests(service, "api-service");
    expect(serviceTests["vitest.config.ts"]).toContain("environment: 'node'");
    expect(serviceTests["vitest.config.ts"]).not.toContain("plugin-react");
    expect(serviceTests["src/__tests__/setup.ts"]).toBeUndefined();
    const servicePkg = JSON.parse(service["package.json"]);
    expect(servicePkg.devDependencies.vitest).toBeTruthy();
    expect(
      servicePkg.devDependencies["@testing-library/react"],
    ).toBeUndefined();
    expect(servicePkg.devDependencies["@vitejs/plugin-react"]).toBeUndefined();

    const game: Record<string, string> = {
      "package.json": JSON.stringify({ dependencies: { phaser: "^3.80.1" } }),
      "src/boot.ts": "console.log('boot');\n",
    };
    const gameTests = await attachGeneratedTests(game, "phaser-html5");
    expect(gameTests["vitest.config.ts"]).toContain("environment: 'jsdom'");
    expect(gameTests["vitest.config.ts"]).not.toContain("plugin-react");
    expect(gameTests["src/__tests__/setup.ts"]).not.toContain(
      "testing-library",
    );
    expect(JSON.stringify(JSON.parse(game["package.json"]))).not.toContain(
      "react",
    );

    const web: Record<string, string> = {
      "package.json": JSON.stringify({ dependencies: { react: "^18.2.0" } }),
    };
    const webTests = await attachGeneratedTests(web, "react-node");
    expect(webTests["vitest.config.ts"]).toContain("plugin-react");
    expect(
      JSON.parse(web["package.json"]).devDependencies["@testing-library/react"],
    ).toBeTruthy();
  });

  it("merges the React/Express billing scaffold only into React + Node stacks", () => {
    expect(billingScaffoldSupported("react-node")).toBe(true);
    expect(billingScaffoldSupported("next-node")).toBe(true);
    for (const stack of ["phaser-html5", "api-service", "python-service"]) {
      expect(billingScaffoldSupported(stack)).toBe(false);
      expect(() => billingScaffoldFiles(stack)).toThrow(/React \+ Node only/);
    }
    const part2 = readFileSync("src/agents/.pipeline_parts/part2.txt", "utf8");
    expect(part2).toContain(
      "if (mergeBilling && billingScaffoldSupported(techStack)) {",
    );
    const part3 = readFileSync("src/agents/.pipeline_parts/part3.txt", "utf8");
    expect(part3).toContain(
      "validateBilling: mergeBilling && billingScaffoldSupported(techStack),",
    );
  });
});

describe("product quality gate is stack-aware (no React pressure)", () => {
  const recipe = {
    id: "todo",
    specKeywords: ["kanban", "drag", "filter"],
  } as unknown as Parameters<typeof assertProductQuality>[1]["recipe"];

  it("passes a real Phaser game without any React App file", () => {
    const main = `import Phaser from "phaser";
// Star Catcher game
class PlayScene extends Phaser.Scene {
  private score = 0;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  create() {
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.add.text(16, 16, "Star Catcher", { color: "#fff" });
    this.physics.world.setBounds(0, 0, 800, 600);
  }
  update() {
    if (this.cursors?.left.isDown) this.score -= 1;
    if (this.cursors?.right.isDown) this.score += 1;
  }
}
new Phaser.Game({ type: Phaser.AUTO, width: 800, height: 600, scene: [PlayScene], physics: { default: "arcade" } });
`;
    const result = assertProductQuality(
      { "src/main.ts": main, "index.html": "<canvas></canvas>" },
      {
        description: "a game",
        title: "Star Catcher",
        techStack: "phaser-html5",
        recipe,
      },
    );
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("passes an API service with real routes and never asks for App UI", () => {
    const server = `import express from "express";
// Ledger API
const app = express();
app.use(express.json());
const entries: { id: number; amount: number }[] = [];
app.get("/health", (_req, res) => res.json({ ok: true, service: "Ledger API" }));
app.get("/entries", (_req, res) => res.json(entries));
app.post("/entries", (req, res) => {
  const entry = { id: entries.length + 1, amount: Number(req.body.amount) };
  entries.push(entry);
  res.status(201).json(entry);
});
app.listen(Number(process.env.PORT ?? 8080));
`;
    const result = assertProductQuality(
      { "src/server.ts": server, "package.json": "{}" },
      {
        description: "ledger",
        title: "Ledger API",
        techStack: "api-service",
        recipe,
      },
    );
    expect(result.ok).toBe(true);
    expect(result.errors.join(" ")).not.toMatch(/App UI|recipe/);
  });

  it("requires the adapter's own entrypoint for non-React stacks", () => {
    const result = assertProductQuality(
      { "src/App.tsx": "x".repeat(500) },
      { description: "svc", title: "", techStack: "node-service" },
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("src/index.ts");
  });

  it("still rejects a thin React stub on React stacks", () => {
    const result = assertProductQuality(
      {
        "src/App.tsx":
          "export function App() { return <h1>Your app is ready</h1>; }",
      },
      { description: "todo", title: "Todo", techStack: "react-node" },
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/App UI too thin/);
  });

  it("the pipeline passes the build stack into the quality gate", () => {
    const part3 = readFileSync(
      join(process.cwd(), "src/agents/.pipeline_parts/part3.txt"),
      "utf8",
    );
    expect(part3).toMatch(
      /assertProductQuality\(generatedFiles, \{[^}]*techStack,[^}]*\}\)/,
    );
  });
});

describe("manual deploy endpoint follows stack rules", () => {
  it("refuses structural-only stacks and unsupported destinations", () => {
    for (const adapter of STACK_ADAPTERS) {
      const result = manualDeployPreflight(adapter.id, "vercel");
      if (adapter.generationMode === "structural") {
        expect(result).toMatchObject({
          ok: false,
          status: 409,
          error: "structural_only_stack",
        });
      } else if (!adapter.deploymentTargets.includes("vercel")) {
        expect(result).toMatchObject({
          ok: false,
          error: "destination_unsupported",
        });
      } else {
        expect(result).toEqual({ ok: true });
      }
    }
  });

  it("POST /api/build/deploy goes through the preflight and deployProject", () => {
    const route = readFileSync(
      join(process.cwd(), "src/routes/build.ts"),
      "utf8",
    );
    expect(route).not.toMatch(/deployToVercel\(/);
    expect(route).toContain('manualDeployPreflight(techStack, "vercel")');
    expect(route).toMatch(
      /deployProject\(\{[\s\S]*techStack,[\s\S]*productContract,/,
    );
  });
});
