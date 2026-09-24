/**
 * Post-generation hardening, driven by the selected stack adapter.
 *
 * Every stack gets the same safe floor (strip LLM filename headers, drop known
 * bogus/stub packages, stack-accurate README/.gitignore). Stack-specific
 * toolchain repair only runs for the adapter that owns that toolchain:
 *   - "vite-react": React + Vite web/desktop front ends
 *   - "next":       Next.js App Router
 *   - "vite-ts":    Phaser / Three.js on Vite + TypeScript (never React)
 *   - "preserve":   everything else. Hardening never invents a package.json,
 *                   React, Vite, or a tsconfig for these stacks.
 * An unknown stack is rejected rather than silently treated as React.
 */

import { getStackAdapter, type StackAdapter } from "./stackAdapters.js";

/** Stacks that get full sandbox validation and this reliability pass. */
export const GOLDEN_STACKS = [
  "react-node",
  "next-node",
  "vue-node",
  "svelte-node",
  "remix-node",
  "vanilla-node",
  "react-supabase",
  "astro-node",
  "data-visualization",
  "three-js-3d",
  "phaser-html5",
  "babylon-js-3d",
  "electron-react",
  "capacitor-ionic",
] as const;

export type GoldenStack = (typeof GOLDEN_STACKS)[number];

export function isGoldenStack(stack: string): boolean {
  return (GOLDEN_STACKS as readonly string[]).includes(stack);
}

export type HardeningProfile = "vite-react" | "next" | "vite-ts" | "preserve";

const VITE_REACT_STACKS = new Set([
  "react-node",
  "data-visualization",
  "electron-react",
  "tauri-rust",
]);
const VITE_TS_STACKS = new Set(["phaser-html5", "three-js-3d"]);

/** Resolve the hardening profile from the stack adapter (throws on unknown). */
export function hardeningProfileForStack(techStack: string): HardeningProfile {
  const adapter = getStackAdapter(techStack);
  if (adapter.id === "next-node") return "next";
  if (VITE_REACT_STACKS.has(adapter.id)) return "vite-react";
  if (VITE_TS_STACKS.has(adapter.id)) return "vite-ts";
  return "preserve";
}

/**
 * Golden web limits (file cap, compliance stripping) apply only to runnable
 * bundler web stacks. Desktop shells, mobile, services and Python keep every
 * generated file.
 */
export function appliesGoldenWebLimits(techStack: string): boolean {
  const adapter = getStackAdapter(techStack);
  return (
    adapter.generationMode === "runnable" &&
    hardeningProfileForStack(adapter.id) !== "preserve"
  );
}

/**
 * The compliance boilerplate is TypeScript for Node servers. It is only added
 * to Node service stacks, never to Python, Flutter, extension, static or
 * bundler front-end projects.
 */
export function complianceScaffoldingAllowed(techStack: string): boolean {
  const adapter = getStackAdapter(techStack);
  return (
    adapter.runtime === "node" &&
    hardeningProfileForStack(adapter.id) === "preserve"
  );
}

function tryAdapter(techStack: string): StackAdapter | null {
  try {
    return getStackAdapter(techStack);
  } catch {
    return null;
  }
}

/** Remove `// filename:` / markdown fences the LLM leaves in file bodies. */
export function stripFilenameHeaders(content: string): string {
  let out = content.replace(/^\/\/\s*filename:\s*.+\r?\n?/gim, "");
  out = out.replace(/^\/\/\s*file:\s*.+\r?\n?/gim, "");
  out = out.replace(/^```[a-zA-Z0-9]*\r?\n/m, "");
  out = out.replace(/\r?\n```\s*$/m, "");
  return out.trimStart();
}

const BOGUS_PACKAGES = [
  "html5-game-engine",
  "unity-webgl-loader",
  "ai-agent-sdk",
  "stub",
  "placeholder",
];

/**
 * Drop only packages that are known not to exist or are LLM stubs. Real
 * stack dependencies (helmet, playwright, fastify, electron, expo, …) are kept.
 */
function filterDeps(deps: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(deps)) {
    if (BOGUS_PACKAGES.includes(k)) continue;
    if (typeof v !== "string" || v === "stub" || v === "placeholder") continue;
    out[k] = v;
  }
  return out;
}

function readPackage(
  files: Record<string, string>,
): Record<string, unknown> | null {
  const raw = files["package.json"];
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function record(value: unknown): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, string>) }
    : {};
}

/** Remove bogus deps from an existing package.json without adding anything. */
function sanitizeExistingPackage(files: Record<string, string>): void {
  const raw = files["package.json"];
  if (typeof raw !== "string") return;
  let pkg: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    pkg = parsed as Record<string, unknown>;
  } catch {
    // Leave unparseable manifests untouched for validation to report.
    return;
  }
  for (const key of ["dependencies", "devDependencies"] as const) {
    if (pkg[key] !== undefined) pkg[key] = filterDeps(record(pkg[key]));
  }
  files["package.json"] = JSON.stringify(pkg, null, 2);
}

function ensureJsonPackage(
  files: Record<string, string>,
  profile: Exclude<HardeningProfile, "preserve">,
): void {
  const pkg = readPackage(files) ?? {};
  const deps = filterDeps(record(pkg.dependencies));
  const devDeps = filterDeps(record(pkg.devDependencies));
  const scripts = record(pkg.scripts);

  if (profile === "vite-react") {
    deps.react = deps.react ?? "^18.2.0";
    deps["react-dom"] = deps["react-dom"] ?? "^18.2.0";
    devDeps.vite = devDeps.vite ?? "^5.1.0";
    devDeps["@vitejs/plugin-react"] =
      devDeps["@vitejs/plugin-react"] ?? "^4.2.1";
    devDeps.typescript = devDeps.typescript ?? "^5.3.3";
    devDeps["@types/react"] = devDeps["@types/react"] ?? "^18.2.55";
    devDeps["@types/react-dom"] = devDeps["@types/react-dom"] ?? "^18.2.19";
    scripts.dev = scripts.dev ?? "vite";
    scripts.build = scripts.build?.includes("tsc -b")
      ? "vite build"
      : (scripts.build ?? "vite build");
    scripts.preview = scripts.preview ?? "vite preview";
    scripts.typecheck = scripts.typecheck ?? "tsc --noEmit";
  } else if (profile === "vite-ts") {
    devDeps.vite = devDeps.vite ?? "^5.1.0";
    devDeps.typescript = devDeps.typescript ?? "^5.3.3";
    scripts.dev = scripts.dev ?? "vite";
    scripts.build = scripts.build ?? "vite build";
    scripts.preview = scripts.preview ?? "vite preview";
    scripts.typecheck = scripts.typecheck ?? "tsc --noEmit";
  } else {
    deps.next = deps.next ?? "^14.1.0";
    deps.react = deps.react ?? "^18.2.0";
    deps["react-dom"] = deps["react-dom"] ?? "^18.2.0";
    scripts.dev = scripts.dev ?? "next dev";
    scripts.build = scripts.build ?? "next build";
    scripts.start = scripts.start ?? "next start";
  }

  pkg.name =
    typeof pkg.name === "string" && pkg.name.length > 0
      ? pkg.name
      : "appforge-app";
  pkg.private = true;
  pkg.version = pkg.version ?? "0.1.0";
  if (profile !== "next") pkg.type = pkg.type ?? "module";
  pkg.scripts = scripts;
  pkg.dependencies = deps;
  pkg.devDependencies = devDeps;

  files["package.json"] = JSON.stringify(pkg, null, 2);
}

function ensureTailwindToolchain(files: Record<string, string>): void {
  const css = files["src/index.css"] ?? files["src/styles.css"] ?? "";
  const usesTailwind =
    css.includes("@tailwind") ||
    Object.values(files).some(
      (c) =>
        typeof c === "string" &&
        /className\s*=\s*["'][^"']*\b(flex|grid|text-|bg-|p-|m-|rounded)/.test(
          c,
        ),
    );
  if (!usesTailwind) return;

  if (!files["src/index.css"]) {
    files["src/index.css"] =
      `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody { margin: 0; min-height: 100vh; }\n`;
  } else if (!files["src/index.css"].includes("@tailwind")) {
    files["src/index.css"] =
      `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n` +
      files["src/index.css"];
  }

  if (!files["tailwind.config.js"] && !files["tailwind.config.ts"]) {
    files["tailwind.config.js"] =
      `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n`;
  }

  if (!files["postcss.config.js"] && !files["postcss.config.cjs"]) {
    files["postcss.config.js"] =
      `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n`;
  }

  try {
    const pkg = JSON.parse(files["package.json"] || "{}") as {
      devDependencies?: Record<string, string>;
    };
    pkg.devDependencies = pkg.devDependencies ?? {};
    pkg.devDependencies.tailwindcss =
      pkg.devDependencies.tailwindcss ?? "^3.4.0";
    pkg.devDependencies.postcss = pkg.devDependencies.postcss ?? "^8.4.35";
    pkg.devDependencies.autoprefixer =
      pkg.devDependencies.autoprefixer ?? "^10.4.17";
    files["package.json"] = JSON.stringify(pkg, null, 2);
  } catch {
    /* ignore */
  }
}

function ensureTsconfig(
  files: Record<string, string>,
  profile: Exclude<HardeningProfile, "preserve">,
): void {
  const jsx: Record<string, unknown> =
    profile === "next"
      ? { jsx: "preserve" }
      : profile === "vite-react"
        ? { jsx: "react-jsx" }
        : {};
  const defaultInclude = profile === "next" ? ["app", "src"] : ["src"];
  if (files["tsconfig.json"]) {
    try {
      const ts = JSON.parse(files["tsconfig.json"]) as {
        compilerOptions?: Record<string, unknown>;
        include?: string[];
      };
      ts.compilerOptions = {
        target: "ES2020",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        ...jsx,
        strict: true,
        isolatedModules: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        allowImportingTsExtensions: false,
        ...(ts.compilerOptions || {}),
        skipLibCheck: true,
        noEmit: true,
        moduleResolution: "bundler",
      };
      ts.include = ts.include?.length ? ts.include : defaultInclude;
      const include = ts.include.filter((p) => !p.includes("compliance"));
      ts.include = include.length ? include : ["src"];
      files["tsconfig.json"] = JSON.stringify(ts, null, 2);
      return;
    } catch {
      /* rewrite below */
    }
  }

  files["tsconfig.json"] = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        ...jsx,
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        isolatedModules: true,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      include: defaultInclude,
    },
    null,
    2,
  );
}

function ensureViteEntrypoints(files: Record<string, string>): void {
  if (!files["index.html"]) {
    files["index.html"] =
      `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>AppForge App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`;
  }

  if (!files["vite.config.ts"] && !files["vite.config.js"]) {
    files["vite.config.ts"] =
      `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { port: 5173, host: true },\n});\n`;
  }

  if (!files["src/vite-env.d.ts"]) {
    files["src/vite-env.d.ts"] = `/// <reference types="vite/client" />\n`;
  }

  if (
    !files["src/main.tsx"] &&
    !files["src/main.ts"] &&
    !files["src/main.jsx"]
  ) {
    files["src/main.tsx"] =
      `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport { App } from "./App";\nimport "./index.css";\n\nconst root = document.getElementById("root");\nif (root) {\n  createRoot(root).render(\n    <React.StrictMode>\n      <App />\n    </React.StrictMode>,\n  );\n}\n`;
  }

  if (!files["src/App.tsx"] && !files["src/App.jsx"] && !files["src/App.vue"]) {
    files["src/App.tsx"] =
      `export function App() {\n  return (\n    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-8">\n      <div className="max-w-lg text-center space-y-4">\n        <p className="text-sm font-medium text-cyan-400 tracking-wide uppercase">AppForge</p>\n        <h1 className="text-3xl font-semibold tracking-tight">Your app is ready</h1>\n        <p className="text-slate-400 text-sm leading-relaxed">Reliability-first scaffold — replace this screen with your product UI.</p>\n      </div>\n    </main>\n  );\n}\n`;
  }

  if (!files["src/index.css"]) {
    files["src/index.css"] =
      `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }\nbody { margin: 0; min-height: 100vh; background: #020617; }\n`;
  }

  const mainKey = files["src/main.tsx"]
    ? "src/main.tsx"
    : files["src/main.ts"]
      ? "src/main.ts"
      : null;
  if (
    mainKey &&
    files["src/index.css"] &&
    !files[mainKey].includes("index.css")
  ) {
    files[mainKey] = `import "./index.css";\n${files[mainKey]}`;
  }
}

function ensureNextEntrypoints(files: Record<string, string>): void {
  if (!files["app/page.tsx"] && !files["pages/index.tsx"]) {
    files["app/page.tsx"] =
      `export default function Page() {\n  return (\n    <main style={{ fontFamily: "system-ui", padding: 32 }}>\n      <h1>Your Next.js app is ready</h1>\n    </main>\n  );\n}\n`;
  }
  if (!files["app/layout.tsx"]) {
    files["app/layout.tsx"] =
      `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body style={{ margin: 0 }}>{children}</body>\n    </html>\n  );\n}\n`;
  }
}

function fixBrokenRelativeImports(files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    if (!/\.(tsx?|jsx?)$/.test(path)) continue;
    files[path] = content.replace(
      /(from\s+["'])(\.[^"']+)\.(tsx?|jsx?)(["'])/g,
      "$1$2$4",
    );
  }
}

function ensureAppExportsMatchMain(files: Record<string, string>): void {
  const main = files["src/main.tsx"] ?? files["src/main.ts"] ?? "";
  const app = files["src/App.tsx"] ?? files["src/App.jsx"] ?? "";
  if (!main || !app) return;

  const mainWantsNamed = /import\s*\{\s*App\s*\}\s*from\s*["']\.\/App/.test(
    main,
  );
  const mainWantsDefault =
    /import\s+App\s+from\s*["']\.\/App/.test(main) && !mainWantsNamed;
  const hasNamed = /export\s+function\s+App\b|export\s+const\s+App\b/.test(app);
  const hasDefault =
    /export\s+default\s+function\b|export\s+default\s+App/.test(app);

  if (mainWantsNamed && !hasNamed && hasDefault) {
    files["src/App.tsx"] = `${app}\nexport { default as App };\n`;
  } else if (mainWantsDefault && !hasDefault && hasNamed) {
    files["src/App.tsx"] = `${app}\nexport default App;\n`;
  }
}

function patchComplianceReactImports(files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith("compliance/") || !path.endsWith(".tsx")) continue;
    if (
      /\buseState\b|\buseEffect\b/.test(content) &&
      !/from\s+["']react["']/.test(content)
    ) {
      files[path] = `import { useState } from "react";\n${content}`;
    }
  }
}

function stackReadme(adapter: StackAdapter): string {
  const lines = [`# AppForge project (${adapter.label})`, ""];
  lines.push(`Dependency manifest: \`${adapter.dependencyManifest}\``);
  lines.push(
    `Entrypoints: ${adapter.entrypoints.map((e) => `\`${e}\``).join(", ")}`,
  );
  lines.push("");
  lines.push("```bash");
  if (adapter.runtime === "python") {
    lines.push("pip install -r requirements.txt");
  } else if (adapter.dependencyManifest === "pubspec.yaml") {
    lines.push("flutter pub get");
  } else {
    lines.push("npm install");
  }
  if (adapter.buildCommand) lines.push(adapter.buildCommand);
  if (adapter.startCommand) lines.push(adapter.startCommand);
  lines.push("```");
  if (adapter.generationMode === "structural") {
    lines.push(
      "",
      `Structural-only stack: AppForge generated the ${adapter.runtime} project structure but has not verified it on the native toolchain and has not deployed it.`,
    );
  }
  return lines.join("\n") + "\n";
}

function stackGitignore(adapter: StackAdapter): string {
  const entries = [".env", ".env.local", ".DS_Store"];
  if (adapter.runtime === "python") {
    entries.push("__pycache__/", "*.pyc", ".venv/", ".pytest_cache/");
  } else if (adapter.dependencyManifest === "pubspec.yaml") {
    entries.push("build/", ".dart_tool/", ".flutter-plugins*");
  } else {
    entries.push("node_modules", "dist", "coverage");
  }
  if (adapter.id === "next-node") entries.push(".next");
  if (adapter.id === "tauri-rust") entries.push("src-tauri/target");
  if (adapter.id === "electron-react") entries.push("dist-electron", "release");
  if (adapter.id === "react-native-expo") entries.push(".expo");
  return entries.join("\n") + "\n";
}

export function hardenGeneratedProject(
  files: Record<string, string>,
  techStack: string,
): Record<string, string> {
  const adapter = getStackAdapter(techStack);
  const profile = hardeningProfileForStack(adapter.id);

  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== "string") continue;
    if (path.endsWith(".png") || path.endsWith(".jpg")) continue;
    files[path] = stripFilenameHeaders(content);
  }

  if (profile === "preserve") {
    sanitizeExistingPackage(files);
  } else {
    ensureJsonPackage(files, profile);
    ensureTsconfig(files, profile);
    if (profile === "next") {
      ensureNextEntrypoints(files);
    } else if (profile === "vite-react") {
      ensureViteEntrypoints(files);
      ensureTailwindToolchain(files);
      ensureJsonPackage(files, profile);
      ensureAppExportsMatchMain(files);
    }
    if (profile === "vite-react" || profile === "next") {
      patchComplianceReactImports(files);
    }
    // Bundler resolution only: NodeNext services need explicit extensions.
    fixBrokenRelativeImports(files);
  }

  if (!files["README.md"]) files["README.md"] = stackReadme(adapter);
  if (!files[".gitignore"]) files[".gitignore"] = stackGitignore(adapter);

  return files;
}

const VITE_REACT_RULES = [
  "3. Visible UI on first paint. React 18 + TypeScript + Tailwind only.",
  "4. Paths: src/App.tsx, src/main.tsx, index.html.",
  "5. Extensionless relative imports. Match App export to main.tsx.",
  "6. package.json: only real public npm packages — no invented UI kits.",
  "7. Scripts: dev, build (vite build), typecheck.",
];

function stackSpecificRules(adapter: StackAdapter): string[] {
  const profile = hardeningProfileForStack(adapter.id);
  if (profile === "vite-react") {
    const rules = [...VITE_REACT_RULES];
    if (adapter.id === "electron-react")
      rules.push("Keep the Electron main process in electron/main.ts.");
    if (adapter.id === "tauri-rust")
      rules.push(
        "Keep the Rust shell in src-tauri/ (Cargo.toml, src/main.rs, tauri.conf.json).",
      );
    return rules;
  }
  if (profile === "next") {
    return [
      "3. Next.js 14 App Router + React 18 + TypeScript. Visible UI on first paint.",
      "4. Paths: app/layout.tsx, app/page.tsx; route handlers in app/api/**/route.ts.",
      "5. package.json scripts: dev (next dev), build (next build), start (next start).",
      "6. Only real public npm packages. Do not add Vite.",
    ];
  }
  const framework =
    adapter.id === "phaser-html5"
      ? "Phaser 3 + TypeScript on Vite. Do NOT use React."
      : adapter.id === "three-js-3d"
        ? "Three.js + TypeScript on Vite. Do NOT use React."
        : `${adapter.label}. Do NOT convert this project to React, Vite or another stack.`;
  const rules = [
    `3. Stack: ${framework}`,
    `4. Entrypoints: ${adapter.entrypoints.join(", ")}. Dependency manifest: ${adapter.dependencyManifest}.`,
  ];
  if (adapter.buildCommand)
    rules.push(`5. Build command: ${adapter.buildCommand}.`);
  if (adapter.startCommand)
    rules.push(`6. Start command: ${adapter.startCommand}.`);
  rules.push("7. Only real, published dependencies for this ecosystem.");
  return rules;
}

/** Coder rules for the selected stack adapter; empty for unknown stacks. */
export function goldenCoderRules(techStack: string): string {
  const adapter = tryAdapter(techStack);
  if (!adapter) return "";
  return [
    "RELIABILITY RULES (highest priority):",
    "1. Output ONLY complete, compilable files with // filename: path markers.",
    "2. Prefer a small coherent file set (≤12 files).",
    ...stackSpecificRules(adapter),
    "8. No compliance/auth scaffolding unless explicitly requested.",
  ].join("\n");
}

export function maxFixRetriesForStack(techStack: string): number {
  const adapter = tryAdapter(techStack);
  if (!adapter) return 2;
  return hardeningProfileForStack(adapter.id) === "preserve" ? 2 : 3;
}

export function assertBuildableShape(
  files: Record<string, string>,
  techStack: string,
): string[] {
  const adapter = getStackAdapter(techStack);
  const profile = hardeningProfileForStack(adapter.id);
  const problems: string[] = [];
  const hardened = hardenGeneratedProject({ ...files }, adapter.id);

  if (!hardened[adapter.dependencyManifest]) {
    problems.push(`missing ${adapter.dependencyManifest}`);
  }
  if (hardened["package.json"]) {
    try {
      const pkg = JSON.parse(hardened["package.json"]);
      if (
        adapter.dependencyManifest === "package.json" &&
        adapter.buildCommand?.startsWith("npm run build") &&
        !pkg.scripts?.build
      ) {
        problems.push("package.json missing build script");
      }
      for (const bad of BOGUS_PACKAGES) {
        if (pkg.dependencies?.[bad]) problems.push(`bogus dep ${bad}`);
      }
    } catch {
      problems.push("package.json invalid JSON");
    }
  }
  if (profile === "next") {
    if (!hardened["app/page.tsx"] && !hardened["pages/index.tsx"]) {
      problems.push("missing Next.js page");
    }
  } else if (profile === "vite-react") {
    if (!hardened["index.html"]) problems.push("missing index.html");
    if (!hardened["src/main.tsx"] && !hardened["src/main.ts"]) {
      problems.push("missing src/main entry");
    }
    if (!hardened["src/App.tsx"] && !hardened["src/App.jsx"]) {
      problems.push("missing App component");
    }
  } else {
    for (const entry of adapter.entrypoints) {
      if (!hardened[entry]) problems.push(`missing entrypoint ${entry}`);
    }
  }
  return problems;
}
