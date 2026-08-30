/**
 * Known-good project shells for each stack.
 * Golden stacks get a Vite + React + Tailwind shell that already typechecks & builds.
 */

export type ScaffoldFiles = Record<string, string>;

function viteReactShell(title = "AppForge App"): ScaffoldFiles {
  return {
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
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-4">
        <p className="text-sm font-medium text-cyan-400 tracking-wide uppercase">
          AppForge
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">${title}</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Scaffold is ready. Your generated UI will replace this screen.
        </p>
      </div>
    </main>
  );
}
`,
    "README.md": `# ${title}\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
    ".gitignore": `node_modules\ndist\n.env\n.env.local\ncoverage\n.DS_Store\n`,
  };
}

function nextShell(title = "AppForge App"): ScaffoldFiles {
  return {
    "package.json": JSON.stringify(
      {
        name: "appforge-next",
        private: true,
        version: "0.1.0",
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
        },
        dependencies: {
          next: "^14.1.0",
          react: "^18.2.0",
          "react-dom": "^18.2.0",
        },
        devDependencies: {
          "@types/node": "^20.11.0",
          "@types/react": "^18.2.55",
          "@types/react-dom": "^18.2.19",
          typescript: "^5.3.3",
        },
      },
      null,
      2,
    ),
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2017",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
    "next-env.d.ts": `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n`,
    "app/layout.tsx": `export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
`,
    "app/page.tsx": `export default function Page() {
  return (
    <main style={{ padding: 48 }}>
      <h1>${title}</h1>
      <p>Next.js scaffold ready.</p>
    </main>
  );
}
`,
    "README.md": `# ${title}\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
  };
}

/** Return a known-good file tree for the given stack id. */
export function getStackScaffold(techStack: string): ScaffoldFiles {
  const stack = (techStack || "react-node").toLowerCase();
  if (stack.includes("next")) return nextShell();
  // Default: Vite React for react-node, vue-node fallbacks, supabase, data-viz, etc.
  return viteReactShell();
}

/**
 * Merge scaffold under generated files (generated wins on conflict).
 * Ensures essential paths exist without clobbering LLM output.
 */
export function mergeScaffoldWithGenerated(
  scaffold: ScaffoldFiles,
  generated: ScaffoldFiles,
): ScaffoldFiles {
  const out: ScaffoldFiles = { ...scaffold };
  for (const [path, content] of Object.entries(generated)) {
    if (typeof content === "string" && content.trim().length > 0) {
      out[path] = content;
    }
  }
  return out;
}

export default { getStackScaffold, mergeScaffoldWithGenerated };
