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
  out = out.replace(/^```[a-zA-Z0-9]*\r?\n/m, "");
  out = out.replace(/\r?\n```\s*$/m, "");
  return out.trimStart();
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

  // Baseline deps for Vite React family
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
    scripts.build = scripts.build ?? "vite build";
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

  // Drop known-bogus stub packages the old validator injected
  for (const bad of [
    "html5-game-engine",
    "unity-webgl-loader",
    "ai-agent-sdk",
  ]) {
    delete deps[bad];
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
        ...(ts.compilerOptions || {}),
        // Force safe defaults even if LLM overwrote poorly
        skipLibCheck: true,
        noEmit: true,
      };
      ts.include = ts.include?.length
        ? ts.include
        : techStack.includes("next")
          ? ["app", "src"]
          : ["src"];
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
    files["index.html"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AppForge App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  }

  if (!files["vite.config.ts"] && !files["vite.config.js"]) {
    files["vite.config.ts"] = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
});
`;
  }

  if (!files["src/vite-env.d.ts"]) {
    files["src/vite-env.d.ts"] = `/// <reference types="vite/client" />
`;
  }

  if (!files["src/main.tsx"] && !files["src/main.ts"] && !files["src/main.jsx"]) {
    files["src/main.tsx"] = `import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
`;
  }

  if (!files["src/App.tsx"] && !files["src/App.jsx"] && !files["src/App.vue"]) {
    files["src/App.tsx"] = `export function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-4">
        <p className="text-sm font-medium text-cyan-400 tracking-wide uppercase">
          AppForge
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Your app is ready</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          This project was generated with a reliability-first scaffold. Replace this
          screen with your product UI — the build already typechecks and bundles.
        </p>
      </div>
    </main>
  );
}
`;
  }

  if (!files["src/index.css"]) {
    files["src/index.css"] = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  background: #020617;
}
`;
  }

  // Ensure main imports css if present
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
    files["app/page.tsx"] = `export default function Page() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>Your Next.js app is ready</h1>
      <p>Generated by AppForge with a reliability-first scaffold.</p>
    </main>
  );
}
`;
  }
  if (!files["app/layout.tsx"]) {
    files["app/layout.tsx"] = `export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
`;
  }
}

function fixBrokenRelativeImports(files: Record<string, string>): void {
  // Prefer extensionless imports for TS — strip erroneous .ts/.tsx from import paths in source
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
  const hasDefault = /export\s+default\s+function\b|export\s+default\s+App/.test(
    app,
  );

  if (mainWantsNamed && !hasNamed && hasDefault) {
    // Add named re-export
    files["src/App.tsx"] = `${app}\nexport { default as App };\n`;
  } else if (mainWantsDefault && !hasDefault && hasNamed) {
    files["src/App.tsx"] = `${app}\nexport default App;\n`;
  } else if (mainWantsNamed && !hasNamed && !hasDefault) {
    // Leave as-is; reliability App scaffold handles missing App
  }
}

/**
 * Harden a generated file tree for golden stacks.
 * Mutates and returns the same object.
 */
export function hardenGeneratedProject(
  files: Record<string, string>,
  techStack: string,
): Record<string, string> {
  // 1. Clean every text-ish file body
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== "string") continue;
    if (path.endsWith(".png") || path.endsWith(".jpg")) continue;
    files[path] = stripFilenameHeaders(content);
  }

  // 2. package.json / tsconfig
  ensureJsonPackage(files, techStack);
  ensureTsconfig(files, techStack);

  // 3. Entrypoints
  if (techStack.includes("next")) {
    ensureNextEntrypoints(files);
  } else if (
    isGoldenStack(techStack) ||
    techStack.includes("react") ||
    techStack.includes("vite")
  ) {
    ensureViteEntrypoints(files, techStack);
  }

  // 4. Import hygiene
  fixBrokenRelativeImports(files);
  ensureAppExportsMatchMain(files);

  // 5. Minimal README if missing
  if (!files["README.md"]) {
    files["README.md"] = `# AppForge project\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;
  }

  if (!files[".gitignore"]) {
    files[".gitignore"] = `node_modules\ndist\n.env\n.env.local\ncoverage\n.DS_Store\n`;
  }

  return files;
}

/** Coder system addendum for golden stacks — prioritise green builds. */
export function goldenCoderRules(techStack: string): string {
  if (!isGoldenStack(techStack) && !techStack.includes("react")) {
    return "";
  }
  return `
RELIABILITY RULES (highest priority — world-class green builds):
1. Output ONLY complete, compilable files. Every file starts with // filename: path/to/file.ext
2. Prefer a small, coherent file set over many half-finished modules.
3. MUST produce a visible UI on first paint (hero or dashboard), not an empty shell.
4. Use React 18 function components + TypeScript. Match scaffold paths: src/App.tsx, src/main.tsx, index.html.
5. For styling: Tailwind utility classes + src/index.css with @tailwind directives. Do NOT invent missing UI libraries.
6. Imports: extensionless relative imports (./App not ./App.tsx). Named or default export must match main.tsx.
7. package.json: only real public npm packages with semver ranges. No stub package names.
8. Include working npm scripts: dev, build, typecheck.
9. Skip heavy compliance/auth/rate-limit scaffolding unless the user explicitly asked — keep the app compiling first.
10. If fixing errors: change only the broken files; preserve working UI.
`.trim();
}

export function maxFixRetriesForStack(techStack: string): number {
  return isGoldenStack(techStack) || techStack.includes("react") ? 3 : 2;
}
