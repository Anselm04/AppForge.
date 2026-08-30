/**
 * Last-resort deterministic app for golden stacks.
 * Leaders almost never ship a non-runnable tree; if the LLM path fails,
 * we still deliver a compiling Vite + React + Tailwind app shaped by the prompt.
 */

import { hardenGeneratedProject } from "./reliableBuild.js";

function escapeJsString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$")
    .replace(/\n/g, " ")
    .slice(0, 200);
}

/**
 * Build a minimal, known-good Vite React app that typechecks and vite-builds.
 * Incorporates title + description into the visible UI.
 */
export function buildGuaranteedGreenApp(opts: {
  title: string;
  description: string;
  techStack: string;
}): Record<string, string> {
  const title = escapeJsString(opts.title || "AppForge App");
  const blurb = escapeJsString(
    opts.description || "Your app scaffold is ready to customize.",
  );

  const files: Record<string, string> = {
    "package.json": JSON.stringify(
      {
        name: "appforge-app",
        private: true,
        version: "0.1.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
          typecheck: "tsc --noEmit",
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          "@types/react": "^18.2.55",
          "@types/react-dom": "^18.2.19",
          "@vitejs/plugin-react": "^4.2.1",
          autoprefixer: "^10.4.17",
          postcss: "^8.4.35",
          tailwindcss: "^3.4.1",
          typescript: "^5.3.3",
          vite: "^5.1.0",
        },
      },
      null,
      2,
    ),
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          isolatedModules: true,
          esModuleInterop: true,
          resolveJsonModule: true,
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
});
`,
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "postcss.config.js": `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    "tailwind.config.js": `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`,
    "src/vite-env.d.ts": `/// <reference types="vite/client" />
`,
    "src/index.css": `@tailwind base;
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
`,
    "src/main.tsx": `import React from "react";
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
`,
    "src/App.tsx": `export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800/80">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight text-cyan-400">
            AppForge
          </span>
          <nav className="flex gap-4 text-sm text-slate-400">
            <span className="hover:text-slate-200 cursor-default">Product</span>
            <span className="hover:text-slate-200 cursor-default">Docs</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="max-w-2xl space-y-6">
          <p className="text-xs font-medium uppercase tracking-widest text-cyan-400/90">
            Ready to run
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
            ${title}
          </h1>
          <p className="text-base md:text-lg text-slate-400 leading-relaxed">
            ${blurb}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              Get started
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500 transition-colors"
            >
              Learn more
            </button>
          </div>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {["Fast scaffold", "Type-safe", "Tailwind UI"].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
            >
              <h2 className="text-sm font-semibold text-slate-100">{label}</h2>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Guaranteed-green baseline so you always get a running app.
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
`,
    "README.md": `# ${title}\n\nGenerated by AppForge (guaranteed-green baseline).\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
    ".gitignore": `node_modules\ndist\n.env\n.env.local\ncoverage\n.DS_Store\n`,
  };

  return hardenGeneratedProject(files, opts.techStack || "react-node");
}
