/**
 * Recipe library — maps prompts to locked UI shapes that always compile.
 * This is how leaders get high first-pass green rates: constrained surfaces.
 */

export type RecipeId =
  | "landing"
  | "dashboard"
  | "todo"
  | "crm"
  | "auth"
  | "settings"
  | "generic";

export interface AppRecipe {
  id: RecipeId;
  label: string;
  /** Keywords / patterns that select this recipe */
  match: RegExp;
  /** Acceptance keywords that should appear in generated UI source */
  specKeywords: string[];
  /** Short coder instruction for this shape */
  coderHint: string;
}

export const APP_RECIPES: AppRecipe[] = [
  {
    id: "todo",
    label: "Todo / tasks",
    match:
      /\b(todo|to-?do|task\s*list|tasks?|checklist|reminders?)\b/i,
    specKeywords: ["task", "add", "complete"],
    coderHint:
      "Build a todo app: input to add tasks, list with complete toggle, clear done. Local React state only.",
  },
  {
    id: "crm",
    label: "CRM / contacts",
    match:
      /\b(crm|contacts?|leads?|pipeline|customers?|accounts?)\b/i,
    specKeywords: ["contact", "lead", "pipeline"],
    coderHint:
      "Build a CRM shell: sidebar, contacts table, simple lead status badges. Mock data in component state.",
  },
  {
    id: "dashboard",
    label: "Dashboard / admin",
    match:
      /\b(dashboard|admin|analytics|metrics|stats|kpi|overview)\b/i,
    specKeywords: ["dashboard", "stat", "overview"],
    coderHint:
      "Build an admin dashboard: top nav or sidebar, 3-4 stat cards, main content panel with a simple table or list.",
  },
  {
    id: "auth",
    label: "Auth / login",
    match:
      /\b(login|sign\s*up|signup|sign-?in|auth|register|password)\b/i,
    specKeywords: ["email", "password", "sign"],
    coderHint:
      "Build a centered auth card: email, password, primary CTA, secondary link. No real backend.",
  },
  {
    id: "settings",
    label: "Settings",
    match: /\b(settings|preferences|profile\s*settings|account\s*settings)\b/i,
    specKeywords: ["settings", "save", "profile"],
    coderHint:
      "Build a settings page: sections in cards, labeled inputs, Save button.",
  },
  {
    id: "landing",
    label: "Marketing landing",
    match:
      /\b(landing|marketing|homepage|home\s*page|saas|startup|waitlist|pricing)\b/i,
    specKeywords: ["get started", "feature", "hero"],
    coderHint:
      "Build a marketing landing: hero with dual CTAs, 3 feature cards, simple footer.",
  },
  {
    id: "generic",
    label: "Generic app",
    match: /.*/,
    specKeywords: [],
    coderHint:
      "Build a cohesive single-page app shell with header, hero or main panel, and clear primary action.",
  },
];

export function classifyRecipe(description: string): AppRecipe {
  const text = description || "";
  for (const recipe of APP_RECIPES) {
    if (recipe.id === "generic") continue;
    if (recipe.match.test(text)) return recipe;
  }
  return APP_RECIPES.find((r) => r.id === "generic")!;
}

/** Extract a few human words from the prompt for UI labels. */
export function extractEntities(description: string, max = 4): string[] {
  const stop = new Set(
    "a an the and or for with from into to of in on at by is are be this that build app make create simple modern dark".split(
      " ",
    ),
  );
  const words = (description || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  const uniq: string[] = [];
  for (const w of words) {
    if (!uniq.includes(w)) uniq.push(w);
    if (uniq.length >= max) break;
  }
  return uniq.length ? uniq : ["item", "detail", "action"];
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$")
    .replace(/\n/g, " ")
    .slice(0, 180);
}

function baseShell(title: string): Record<string, string> {
  const t = esc(title);
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
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
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
export default defineConfig({ plugins: [react()], server: { port: 5173, host: true } });
`,
    "index.html": `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${t}</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
`,
    "postcss.config.js": `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
`,
    "tailwind.config.js": `/** @type {import('tailwindcss').Config} */
export default { content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"], theme: { extend: {} }, plugins: [] };
`,
    "src/vite-env.d.ts": `/// <reference types="vite/client" />
`,
    "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;
:root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
body { margin: 0; min-height: 100vh; background: #020617; }
`,
    "src/main.tsx": `import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
const root = document.getElementById("root");
if (root) createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
`,
    ".gitignore": `node_modules\ndist\n.env\n.env.local\n`,
  };
}

function appTodo(title: string, entities: string[]): string {
  const item = esc(entities[0] || "task");
  return `import { useState } from "react";

type Task = { id: number; text: string; done: boolean };

export function App() {
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: "Ship ${item} MVP", done: false },
    { id: 2, text: "Review ${item} list", done: true },
  ]);

  function addTask() {
    const t = text.trim();
    if (!t) return;
    setTasks((prev) => [...prev, { id: Date.now(), text: t, done: false }]);
    setText("");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-lg px-6 py-4 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-cyan-400">${esc(title)}</h1>
          <span className="text-xs text-slate-500">{tasks.filter((t) => !t.done).length} open</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-6 py-10 space-y-6">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add a task…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
          <button type="button" onClick={addTask} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400">
            Add
          </button>
        </div>
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() =>
                  setTasks((prev) =>
                    prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
                  )
                }
                className="size-4 accent-cyan-500"
              />
              <span className={task.done ? "text-sm text-slate-500 line-through" : "text-sm text-slate-100"}>
                {task.text}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
`;
}

function appDashboard(title: string, entities: string[]): string {
  const a = esc(entities[0] || "Users");
  const b = esc(entities[1] || "Revenue");
  const c = esc(entities[2] || "Sessions");
  return `export function App() {
  const stats = [
    { label: "${a}", value: "1,284" },
    { label: "${b}", value: "$48.2k" },
    { label: "${c}", value: "9,431" },
    { label: "Conversion", value: "3.8%" },
  ];
  const rows = [
    { name: "Acme Corp", status: "Active", amount: "$1,200" },
    { name: "Globex", status: "Trial", amount: "$0" },
    { name: "Initech", status: "Active", amount: "$890" },
  ];
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      <aside className="hidden md:flex w-56 flex-col border-r border-slate-800 p-4 gap-2">
        <p className="text-sm font-semibold text-cyan-400 mb-4">${esc(title)}</p>
        {["Overview", "Reports", "Settings"].map((item) => (
          <span key={item} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-900 hover:text-slate-100 cursor-default">{item}</span>
        ))}
      </aside>
      <div className="flex-1">
        <header className="border-b border-slate-800 px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Overview of key metrics</p>
        </header>
        <main className="p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-t border-slate-800">
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 text-slate-400">{r.status}</td>
                    <td className="px-4 py-3">{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
`;
}

function appCrm(title: string, entities: string[]): string {
  return `export function App() {
  const contacts = [
    { name: "Jane Doe", company: "Acme", status: "Lead" },
    { name: "Sam Lee", company: "Globex", status: "Qualified" },
    { name: "Alex Kim", company: "Initech", status: "Customer" },
  ];
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-cyan-400">${esc(title)}</h1>
          <button type="button" className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-slate-950">Add contact</button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">Pipeline</p>
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Lead status</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.name} className="border-t border-slate-800">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-slate-400">{c.company}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
`;
}

function appAuth(title: string): string {
  return `export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 space-y-6">
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold text-cyan-400">${esc(title)}</p>
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-xs text-slate-500">Enter your email and password</p>
        </div>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Email</span>
            <input type="email" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40" placeholder="you@company.com" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Password</span>
            <input type="password" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40" placeholder="••••••••" />
          </label>
          <button type="submit" className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-400">
            Sign in
          </button>
        </form>
        <p className="text-center text-xs text-slate-500">
          No account? <span className="text-cyan-400 cursor-default">Sign up</span>
        </p>
      </div>
    </div>
  );
}
`;
}

function appSettings(title: string): string {
  return `export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <h1 className="text-sm font-semibold text-cyan-400">${esc(title)}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Profile settings</p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h2 className="text-sm font-semibold">Profile</h2>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Display name</span>
            <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" defaultValue="Alex Builder" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Email</span>
            <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" defaultValue="alex@appforge.dev" />
          </label>
          <button type="button" className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950">Save</button>
        </section>
      </main>
    </div>
  );
}
`;
}

function appLanding(title: string, blurb: string, entities: string[]): string {
  const f1 = esc(entities[0] || "Fast");
  const f2 = esc(entities[1] || "Reliable");
  const f3 = esc(entities[2] || "Beautiful");
  return `export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800/80">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-cyan-400">${esc(title)}</span>
          <nav className="flex gap-4 text-sm text-slate-400">
            <span>Product</span><span>Pricing</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">${esc(title)}</h1>
          <p className="text-base md:text-lg text-slate-400 leading-relaxed">${esc(blurb)}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-cyan-400">Get started</button>
            <button type="button" className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200">Learn more</button>
          </div>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {["${f1}", "${f2}", "${f3}"].map((label) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-sm font-semibold capitalize">{label}</h2>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">Feature built around your prompt — ready to customize.</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-600">© {new Date().getFullYear()} ${esc(title)}</footer>
    </div>
  );
}
`;
}

/** Intent-preserving guaranteed-green app for a classified recipe. */
export function buildRecipeApp(opts: {
  title: string;
  description: string;
  techStack?: string;
  recipe?: AppRecipe;
}): Record<string, string> {
  const recipe = opts.recipe ?? classifyRecipe(opts.description);
  const title = opts.title || recipe.label;
  const entities = extractEntities(opts.description);
  const files = baseShell(title);

  switch (recipe.id) {
    case "todo":
      files["src/App.tsx"] = appTodo(title, entities);
      break;
    case "dashboard":
      files["src/App.tsx"] = appDashboard(title, entities);
      break;
    case "crm":
      files["src/App.tsx"] = appCrm(title, entities);
      break;
    case "auth":
      files["src/App.tsx"] = appAuth(title);
      break;
    case "settings":
      files["src/App.tsx"] = appSettings(title);
      break;
    case "landing":
    case "generic":
    default:
      files["src/App.tsx"] = appLanding(title, opts.description || recipe.label, entities);
      break;
  }

  files["README.md"] = `# ${esc(title)}\n\nRecipe: ${recipe.id}\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\`\n`;
  return files;
}

/** Soft check: does UI source mention expected keywords for the recipe? */
export function checkRecipeSpec(
  files: Record<string, string>,
  recipe: AppRecipe,
): { ok: boolean; missing: string[] } {
  if (!recipe.specKeywords.length) return { ok: true, missing: [] };
  const blob = Object.entries(files)
    .filter(([p]) => /\.(tsx?|jsx?)$/.test(p))
    .map(([, c]) => c.toLowerCase())
    .join("\n");
  const missing = recipe.specKeywords.filter((k) => !blob.includes(k.toLowerCase()));
  // Pass if at least half the keywords appear
  const ok = missing.length <= Math.floor(recipe.specKeywords.length / 2);
  return { ok, missing };
}

export function recipeCoderHint(description: string): string {
  const recipe = classifyRecipe(description);
  return `RECIPE: ${recipe.id} — ${recipe.coderHint}`;
}
