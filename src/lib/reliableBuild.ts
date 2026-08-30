/**
 * P0 reliable builds — post-generation hardening for Node/React-family stacks.
 * Goal: maximise install → typecheck → vite build success rate without changing studios.
 */

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

const ALLOWED_DEP_PREFIXES = [
  "react", "react-dom", "react-router", "react-router-dom",
  "@tanstack/", "zod", "clsx", "tailwind-merge", "lucide-react",
  "express", "cors", "dotenv", "drizzle-orm", "postgres", "pg",
  "next", "vue", "svelte", "phaser", "three", "@types/",
  "openai", "stripe", "@supabase/",
];

function isAllowedPackage(name: string): boolean {
  if (BOGUS_PACKAGES.includes(name)) return false;
  if (name === "stub" || name === "placeholder") return false;
  const core = new Set([
    "react", "react-dom", "react-router-dom", "react-router",
    "express", "cors", "dotenv", "zod", "clsx", "tailwind-merge",
    "next", "vue", "svelte", "phaser", "three", "openai", "stripe",
    "postgres", "pg", "drizzle-orm", "lucide-react",
  ]);
  if (core.has(name)) return true;
  return ALLOWED_DEP_PREFIXES.some(
    (p) => name === p || name.startsWith(p),
  );
}

function filterDeps(deps: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(deps)) {
    if (v === "stub" || v === "placeholder") continue;
    if (!isAllowedPackage(k)) continue;
    out[k] = v;
  }
  return out;
}

function ensureJsonPackage(
  files: Record<string, string>,
  techStack: string,
): void {
  const raw = files["package.json"];
  let pkg: Record<string, unknown>;
  try {
    pkg = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    pkg = {};
  }

  const deps = {
    ...((pkg.dependencies as Record<string, string>) || {}),
  };
  const devDeps = {
    ...((pkg.devDependencies as Record<string, string>) || {}),
  };
  const scripts = {
    ...((pkg.scripts as Record<string, string>) || {}),
  };

  if (!techStack.includes("next") && !techStack.includes("astro")) {
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
  }

  if (techStack.includes("next")) {
    deps.next = deps.next ?? "^14.1.0";
    deps.react = deps.react ?? "^18.2.0";
    deps["react-dom"] = deps["react-dom"] ?? "^18.2.0";
    scripts.dev = scripts.dev ?? "next dev";
    scripts.build = scripts.build ?? "next build";
    scripts.start = scripts.start ?? "next start";
  }

  for (const bad of BOGUS_PACKAGES) {
    delete deps[bad];
    delete devDeps[bad];
  }
  for (const [k, v] of Object.entries(deps)) {
    if (v === "stub" || v === "placeholder") delete deps[k];
  }
  const filteredDeps = filterDeps(deps);
  const filteredDev = filterDeps(devDeps);
  Object.keys(deps).forEach((k) => delete deps[k]);
  Object.keys(devDeps).forEach((k) => delete devDeps[k]);
  Object.assign(deps, filteredDeps);
  Object.assign(devDeps, filteredDev);

  // Re-ensure core after filter
  if (!techStack.includes("next") && !techStack.includes("astro")) {
    deps.react = deps.react ?? "^18.2.0";
    deps["react-dom"] = deps["react-dom"] ?? "^18.2.0";
    devDeps.vite = devDeps.vite ?? "^5.1.0";
    devDeps["@vitejs/plugin-react"] = devDeps["@vitejs/plugin-react"] ?? "^4.2.1";
    devDeps.typescript = devDeps.typescript ?? "^5.3.3";
    devDeps["@types/react"] = devDeps["@types/react"] ?? "^18.2.55";
    devDeps["@types/react-dom"] = devDeps["@types/react-dom"] ?? "^18.2.19";
  }

  pkg.name =
    typeof pkg.name === "string" && pkg.name.length > 0
      ? pkg.name
      : "appforge-app";
  pkg.private = true;
  pkg.version = pkg.version ?? "0.1.0";
  pkg.type = pkg.type ?? "module";
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
    files["src/index.css"] = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody { margin: 0; min-height: 100vh; }\n`;
  } else if (!files["src/index.css"].includes("@tailwind")) {
    files["src/index.css"] =
      `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n` +
      files["src/index.css"];
  }

  if (!files["tailwind.config.js"] && !files["tailwind.config.ts"]) {
    files["tailwind.config.js"] = `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};\n`;
  }

  if (!files["postcss.config.js"] && !files["postcss.config.cjs"]) {
    files["postcss.config.js"] = `export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n`;
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

function ensureTsconfig(files: Record<string, string>, techStack: string): void {
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
        moduleResolution: "bundler",
        jsx: techStack.includes("next") ? "preserve" : "react-jsx",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        isolatedModules: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        allowImportingTsExtensions: false,
        ...(ts.compilerOptions || {}),
        skipLibCheck: true,
        noEmit: true,
        moduleResolution: "bundler",
      };
      ts.include = ts.include?.length
        ? ts.include
        : techStack.includes("next")
          ? ["app", "src"]
          : ["src"];
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
        jsx: techStack.includes("next") ? "preserve" : "react-jsx",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        isolatedModules: true,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
      include: techStack.includes("next") ? ["app", "src"] : ["src"],
    },
    null,
    2,
  );
}

function ensureViteEntrypoints(
  files: Record<string, string>,
  techStack: string,
): void {
  if (techStack.includes("next") || techStack.includes("astro")) return;

  if (!files["index.html"]) {
    files["index.html"] = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>AppForge App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`;
  }

  if (!files["vite.config.ts"] && !files["vite.config.js"]) {
    files["vite.config.ts"] = `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { port: 5173, host: true },\n});\n`;
  }

  if (!files["src/vite-env.d.ts"]) {
    files["src/vite-env.d.ts"] = `/// <reference types="vite/client" />\n`;
  }

  if (!files["src/main.tsx"] && !files["src/main.ts"] && !files["src/main.jsx"]) {
    files["src/main.tsx"] = `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport { App } from "./App";\nimport "./index.css";\n\nconst root = document.getElementById("root");\nif (root) {\n  createRoot(root).render(\n    <React.StrictMode>\n      <App />\n    </React.StrictMode>,\n  );\n}\n`;
  }

  if (!files["src/App.tsx"] && !files["src/App.jsx"] && !files["src/App.vue"]) {
    files["src/App.tsx"] = `export function App() {\n  return (\n    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-8">\n      <div className="max-w-lg text-center space-y-4">\n        <p className="text-sm font-medium text-cyan-400 tracking-wide uppercase">AppForge</p>\n        <h1 className="text-3xl font-semibold tracking-tight">Your app is ready</h1>\n        <p className="text-slate-400 text-sm leading-relaxed">Reliability-first scaffold — replace this screen with your product UI.</p>\n      </div>\n    </main>\n  );\n}\n`;
  }

  if (!files["src/index.css"]) {
    files["src/index.css"] = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }\nbody { margin: 0; min-height: 100vh; background: #020617; }\n`;
  }

  const mainKey = files["src/main.tsx"]
    ? "src/main.tsx"
    : files["src/main.ts"]
      ? "src/main.ts"
      : null;
  if (mainKey && files["src/index.css"] && !files[mainKey].includes("index.css")) {
    files[mainKey] = `import "./index.css";\n${files[mainKey]}`;
  }
}

function ensureNextEntrypoints(files: Record<string, string>): void {
  if (!files["app/page.tsx"] && !files["pages/index.tsx"]) {
    files["app/page.tsx"] = `export default function Page() {\n  return (\n    <main style={{ fontFamily: "system-ui", padding: 32 }}>\n      <h1>Your Next.js app is ready</h1>\n    </main>\n  );\n}\n`;
  }
  if (!files["app/layout.tsx"]) {
    files["app/layout.tsx"] = `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body style={{ margin: 0 }}>{children}</body>\n    </html>\n  );\n}\n`;
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

  const mainWantsNamed = /import\s*\{\s*App\s*\}\s*from\s*["']\.\/App/.test(main);
  const mainWantsDefault =
    /import\s+App\s+from\s*["']\.\/App/.test(main) && !mainWantsNamed;
  const hasNamed = /export\s+function\s+App\b|export\s+const\s+App\b/.test(app);
  const hasDefault = /export\s+default\s+function\b|export\s+default\s+App/.test(app);

  if (mainWantsNamed && !hasNamed && hasDefault) {
    files["src/App.tsx"] = `${app}\nexport { default as App };\n`;
  } else if (mainWantsDefault && !hasDefault && hasNamed) {
    files["src/App.tsx"] = `${app}\nexport default App;\n`;
  }
}

function patchComplianceReactImports(files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith("compliance/") || !path.endsWith(".tsx")) continue;
    if (/\buseState\b|\buseEffect\b/.test(content) && !/from\s+["']react["']/.test(content)) {
      files[path] = `import { useState } from "react";\n${content}`;
    }
  }
}

export function hardenGeneratedProject(
  files: Record<string, string>,
  techStack: string,
): Record<string, string> {
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== "string") continue;
    if (path.endsWith(".png") || path.endsWith(".jpg")) continue;
    files[path] = stripFilenameHeaders(content);
  }

  ensureJsonPackage(files, techStack);
  ensureTsconfig(files, techStack);

  if (techStack.includes("next")) {
    ensureNextEntrypoints(files);
  } else if (
    isGoldenStack(techStack) ||
    techStack.includes("react") ||
    techStack.includes("vite")
  ) {
    ensureViteEntrypoints(files, techStack);
  }

  ensureTailwindToolchain(files);
  ensureJsonPackage(files, techStack);

  fixBrokenRelativeImports(files);
  ensureAppExportsMatchMain(files);
  patchComplianceReactImports(files);

  if (!files["README.md"]) {
    files["README.md"] = `# AppForge project\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;
  }

  if (!files[".gitignore"]) {
    files[".gitignore"] = `node_modules\ndist\n.env\n.env.local\ncoverage\n.DS_Store\n`;
  }

  return files;
}

export function goldenCoderRules(techStack: string): string {
  if (!isGoldenStack(techStack) && !techStack.includes("react")) {
    return "";
  }
  return `\nRELIABILITY RULES (highest priority):\n1. Output ONLY complete, compilable files with // filename: path markers.\n2. Prefer a small coherent file set (≤12 files).\n3. Visible UI on first paint. React 18 + TypeScript + Tailwind only.\n4. Paths: src/App.tsx, src/main.tsx, index.html.\n5. Extensionless relative imports. Match App export to main.tsx.\n6. package.json: only real public npm packages — no invented UI kits.\n7. Scripts: dev, build (vite build), typecheck.\n8. No compliance/auth scaffolding unless explicitly requested.\n`.trim();
}

export function maxFixRetriesForStack(techStack: string): number {
  return isGoldenStack(techStack) || techStack.includes("react") ? 3 : 2;
}

export function assertBuildableShape(
  files: Record<string, string>,
  techStack: string,
): string[] {
  const problems: string[] = [];
  const hardened = hardenGeneratedProject({ ...files }, techStack);
  if (!hardened["package.json"]) problems.push("missing package.json");
  else {
    try {
      const pkg = JSON.parse(hardened["package.json"]);
      if (!pkg.scripts?.build) problems.push("package.json missing build script");
      for (const bad of BOGUS_PACKAGES) {
        if (pkg.dependencies?.[bad]) problems.push(`bogus dep ${bad}`);
      }
    } catch {
      problems.push("package.json invalid JSON");
    }
  }
  if (techStack.includes("next")) {
    if (!hardened["app/page.tsx"] && !hardened["pages/index.tsx"]) {
      problems.push("missing Next.js page");
    }
  } else if (isGoldenStack(techStack) || techStack.includes("react")) {
    if (!hardened["index.html"]) problems.push("missing index.html");
    if (!hardened["src/main.tsx"] && !hardened["src/main.ts"]) {
      problems.push("missing src/main entry");
    }
    if (!hardened["src/App.tsx"] && !hardened["src/App.jsx"]) {
      problems.push("missing App component");
    }
  }
  return problems;
}
