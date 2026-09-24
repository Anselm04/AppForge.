import {
  assertStackSupportsProduct,
  getStackAdapter,
} from "../lib/stackAdapters.js";
import type { ProductType } from "../lib/productContract.js";
import { getRuntimeArchitecture } from "../lib/runtimeArchitecture.js";
import { PLAYWRIGHT_VERSION } from "../lib/stackDeployment.js";
import {
  ensureGeneratedProjectStructure,
  validateGeneratedProjectStructure,
} from "../lib/generatedProjectStructure.js";

/** Stack-shaped infrastructure shells. Generated product logic must overwrite/add substantive files. */
export type ScaffoldFiles = Record<string, string>;

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function withStackMetadata(
  techStack: string,
  files: ScaffoldFiles,
): ScaffoldFiles {
  const adapter = getStackAdapter(techStack);
  return {
    ...files,
    "appforge.stack.json": json({
      version: 1,
      stack: adapter.id,
      runtime: adapter.runtime,
      entrypoints: adapter.entrypoints,
      dependencyManifest: adapter.dependencyManifest,
      environmentFiles: adapter.environmentFiles,
      projectStructure: adapter.projectStructure,
      buildCommand: adapter.buildCommand,
      startCommand: adapter.startCommand,
      previewMode: adapter.previewMode,
      deploymentTargets: adapter.deploymentTargets,
      outputDirectory: adapter.outputDirectory,
      artifactKind: adapter.artifactKind,
      generationMode: adapter.generationMode,
    }),
    "appforge.preview.json": json({
      stack: adapter.id,
      mode: adapter.previewMode,
      runtime: adapter.runtime,
      outputDirectory: adapter.outputDirectory,
    }),
    "appforge.deploy.json": json({
      stack: adapter.id,
      targets: adapter.deploymentTargets,
      buildCommand: adapter.buildCommand,
      startCommand: adapter.startCommand,
      outputDirectory: adapter.outputDirectory,
      generationMode: adapter.generationMode,
    }),
    "appforge.runtime.json": json(getRuntimeArchitecture(adapter.id)),
  };
}

function isProductImplementationPath(
  techStack: string,
  filePath: string,
): boolean {
  const adapter = getStackAdapter(techStack);
  if (adapter.entrypoints.includes(filePath)) return true;
  return /^(?:src\/App\.(?:tsx|jsx)|app\/page\.(?:tsx|jsx)|lib\/main\.dart|App\.tsx|app\/main\.py)$/i.test(
    filePath,
  );
}

function viteReactShell(title = "Application"): ScaffoldFiles {
  return {
    "package.json": json({
      name: "appforge-app",
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        start: "vite preview --host 0.0.0.0",
        typecheck: "tsc --noEmit",
      },
      dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
      devDependencies: {
        "@types/react": "^18.2.55",
        "@types/react-dom": "^18.2.19",
        "@vitejs/plugin-react": "^4.2.1",
        typescript: "^5.3.3",
        vite: "^5.1.0",
      },
    }),
    "tsconfig.json": json({
      compilerOptions: {
        target: "ES2020",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src"],
    }),
    "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
`,
    "index.html": `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
    "src/main.tsx": `import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
const root = document.getElementById("root");
if (root) createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
`,
    "src/App.tsx": "export function App(){return null;}\n",
    ".env.example":
      "# Client-exposed variables must use the VITE_ prefix; never put secrets here.\nVITE_API_BASE_URL=\n",
    ".gitignore": "node_modules\ndist\n.env\n",
  };
}

function staticShell(title = "Website"): ScaffoldFiles {
  return {
    "package.json": json({
      name: "appforge-static-site",
      private: true,
      version: "0.1.0",
      scripts: {
        build: "mkdir -p dist && cp -R index.html assets dist/",
        preview: "npx serve dist",
      },
      devDependencies: { serve: "^14.2.4" },
    }),
    "index.html": `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><main id="app"></main><script type="module" src="/assets/main.js"></script></body></html>`,
    "assets/main.js": 'document.querySelector("#app");\n',
    "assets/styles.css": "",
    ".gitignore": "node_modules\ndist\n",
  };
}

function nextShell(title = "Application"): ScaffoldFiles {
  return {
    "package.json": json({
      name: "appforge-next",
      private: true,
      version: "0.1.0",
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: {
        next: "^14.1.0",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        typescript: "^5.3.3",
        "@types/node": "^20.11.0",
        "@types/react": "^18.2.55",
        "@types/react-dom": "^18.2.19",
      },
    }),
    "tsconfig.json": json({
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        strict: true,
        noEmit: true,
        module: "esnext",
        moduleResolution: "bundler",
        jsx: "preserve",
        plugins: [{ name: "next" }],
      },
      include: ["**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    }),
    "app/layout.tsx":
      'export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}\n',
    "app/page.tsx": "export default function Page(){return null;}\n",
    "app/api/health/live/route.ts":
      "export async function GET(){return Response.json({ok:true});}\n",
    "app/api/health/ready/route.ts":
      "export async function GET(){return Response.json({ok:true});}\n",
    ".env.example": "PORT=3000\nNEXT_PUBLIC_APP_URL=\n",
  };
}

function phaserShell(title = "Game"): ScaffoldFiles {
  return {
    "package.json": json({
      name: "appforge-phaser-game",
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        typecheck: "tsc --noEmit",
      },
      dependencies: { phaser: "^3.90.0" },
      devDependencies: { typescript: "^5.3.3", vite: "^5.1.0" },
    }),
    "tsconfig.json": json({
      compilerOptions: {
        target: "ES2020",
        lib: ["ES2020", "DOM"],
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
      },
      include: ["src"],
    }),
    "vite.config.ts": `import { defineConfig } from "vite";
export default defineConfig({});
`,
    "index.html": `<!doctype html><html><body><main id="game"></main><script type="module" src="/src/main.ts"></script></body></html>`,
    "src/main.ts": `import Phaser from "phaser";
class MainScene extends Phaser.Scene {
  constructor(){ super("main"); }
  create(){}
}
new Phaser.Game({ type: Phaser.AUTO, parent: "game", width: 960, height: 540, scene: [MainScene] });
`,
    ".env.example":
      "# Browser game: only VITE_-prefixed values are bundled; never put secrets here.\nVITE_LEADERBOARD_URL=\n",
  };
}

function threeShell(title = "3D Experience"): ScaffoldFiles {
  return {
    "package.json": json({
      name: "appforge-three-app",
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        typecheck: "tsc --noEmit",
      },
      dependencies: { three: "^0.169.0" },
      devDependencies: {
        typescript: "^5.3.3",
        vite: "^5.1.0",
        "@types/three": "^0.169.0",
      },
    }),
    "tsconfig.json": json({
      compilerOptions: {
        target: "ES2020",
        lib: ["ES2020", "DOM"],
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
      },
      include: ["src"],
    }),
    "vite.config.ts": `import { defineConfig } from "vite";
export default defineConfig({});
`,
    "index.html":
      '<!doctype html><html><body><canvas id="app"></canvas><script type="module" src="/src/main.ts"></script></body></html>',
    "src/main.ts": `import * as THREE from "three";
const canvas = document.querySelector<HTMLCanvasElement>("#app");
if (!canvas) throw new Error("Missing canvas");
const renderer = new THREE.WebGLRenderer({ canvas });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16/9, 0.1, 100);
camera.position.z = 3;
renderer.setSize(960,540);
renderer.render(scene,camera);
void scene;
`,
    ".env.example":
      "# Browser 3D app: only VITE_-prefixed values are bundled; never put secrets here.\nVITE_ASSET_BASE_URL=\n",
  };
}

type NodeServiceOptions = {
  name: string;
  entry: string;
  env: string;
  dependencies?: Record<string, string>;
  /** Extra imports + route registrations placed before the health routes. */
  imports?: string;
  routes?: string;
  extraFiles?: ScaffoldFiles;
};

function nodeServiceShell(options: NodeServiceOptions): ScaffoldFiles {
  const entry = options.entry;
  const compiledEntry = entry
    .replace(/^src\//, "dist/")
    .replace(/\.ts$/, ".js");
  return {
    ...(options.extraFiles ?? {}),
    "package.json": json({
      name: options.name,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        build: "tsc -p tsconfig.json",
        start: `node ${compiledEntry}`,
        typecheck: "tsc --noEmit",
      },
      dependencies: {
        express: "^5.1.0",
        "express-rate-limit": "^7.5.1",
        helmet: "^8.1.0",
        ...(options.dependencies ?? {}),
      },
      devDependencies: {
        "@types/express": "^5.0.3",
        "@types/node": "^22.0.0",
        typescript: "^5.3.3",
      },
    }),
    "tsconfig.json": json({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src/**/*.ts"],
    }),
    [entry]: `import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
${options.imports ?? ""}
const app = express();
let ready = false;
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
}));
app.use(express.json({ limit: "1mb" }));
// Deploy-time build identity written by AppForge (public/.well-known/appforge-build.json).
app.use("/.well-known", express.static("public/.well-known", { dotfiles: "allow" }));
${options.routes ?? ""}app.get("/health/live", (_req,res) => res.json({ ok: true }));
app.get("/health/ready", (_req,res) => res.status(ready ? 200 : 503).json({ ok: ready }));
const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, () => { ready = true; console.log("listening on " + port); });
const shutdown = (signal: string) => {
  ready = false;
  server.close(() => { console.log("shutdown " + signal); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
`,
    ".env.example": options.env,
  };
}

const AI_AGENT_NODE_FILES: ScaffoldFiles = {
  "src/tools.ts": `export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<string>;
};

export const tools: AgentTool[] = [
  {
    name: "current_time",
    description: "Returns the current UTC time as an ISO-8601 string.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    run: async () => new Date().toISOString(),
  },
];
`,
  "src/agent.ts": `import { tools } from "./tools.js";

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

export class AgentConfigError extends Error {}

export async function runAgent(input: string, systemPrompt: string): Promise<{ output: string; steps: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AgentConfigError("OPENAI_API_KEY is not configured");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\\/$/, "");
  const model = process.env.AGENT_MODEL || "gpt-4o-mini";
  const maxSteps = Math.max(1, Number(process.env.AGENT_MAX_STEPS ?? 6));
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: input },
  ];
  for (let step = 1; step <= maxSteps; step++) {
    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model,
        messages,
        tools: tools.map((tool) => ({
          type: "function",
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
      }),
    });
    if (!response.ok) throw new Error("Model request failed with HTTP " + response.status);
    const data = (await response.json()) as { choices: { message: Message }[] };
    const message = data.choices[0]?.message;
    if (!message) throw new Error("Model returned no message");
    messages.push(message);
    if (!message.tool_calls?.length) return { output: message.content ?? "", steps: step };
    for (const call of message.tool_calls) {
      const tool = tools.find((candidate) => candidate.name === call.function.name);
      let result: string;
      try {
        result = tool
          ? await tool.run(JSON.parse(call.function.arguments || "{}") as Record<string, unknown>)
          : "Unknown tool " + call.function.name;
      } catch (error) {
        result = "Tool error: " + (error instanceof Error ? error.message : String(error));
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  throw new Error("Agent stopped after " + maxSteps + " steps without a final answer");
}
`,
};

const BROWSER_AUTOMATION_FILES: ScaffoldFiles = {
  "src/automation.ts": `import { chromium } from "playwright";

export class AutomationPolicyError extends Error {}

function allowedHosts(): string[] {
  return (process.env.AUTOMATION_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function assertAllowedUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new AutomationPolicyError("Only https URLs can be automated");
  const hosts = allowedHosts();
  if (hosts.length === 0) throw new AutomationPolicyError("AUTOMATION_ALLOWED_HOSTS is not configured");
  if (!hosts.includes(url.hostname.toLowerCase())) {
    throw new AutomationPolicyError("Host " + url.hostname + " is not in AUTOMATION_ALLOWED_HOSTS");
  }
  return url;
}

export async function capturePage(raw: string): Promise<{ url: string; title: string; text: string }> {
  const url = assertAllowedUrl(raw);
  const timeout = Number(process.env.AUTOMATION_TIMEOUT_MS ?? 30000);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout });
    const title = await page.title();
    const text = (await page.locator("body").innerText({ timeout })).slice(0, 20000);
    return { url: page.url(), title, text };
  } finally {
    await browser.close();
  }
}
`,
};

function pythonServiceShell(): ScaffoldFiles {
  return {
    "requirements.txt":
      "fastapi>=0.116,<1\nuvicorn[standard]>=0.35,<1\nslowapi>=0.1.9,<1\n",
    "app/__init__.py": "",
    "app/main.py":
      'import os\nfrom contextlib import asynccontextmanager\nimport uvicorn\nfrom fastapi import FastAPI, Request\nfrom fastapi.responses import JSONResponse\nfrom slowapi import Limiter, _rate_limit_exceeded_handler\nfrom slowapi.errors import RateLimitExceeded\nfrom slowapi.middleware import SlowAPIMiddleware\nfrom slowapi.util import get_remote_address\n\nMAX_BODY_BYTES = 1024 * 1024\nready = False\nlimiter = Limiter(key_func=get_remote_address, default_limits=["300/15minutes"])\n\n@asynccontextmanager\nasync def lifespan(app: FastAPI):\n    global ready\n    ready = True\n    try:\n        yield\n    finally:\n        ready = False\n\napp = FastAPI(lifespan=lifespan)\napp.state.limiter = limiter\napp.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)\napp.add_middleware(SlowAPIMiddleware)\n\n@app.middleware("http")\nasync def security_middleware(request: Request, call_next):\n    content_length = request.headers.get("content-length")\n    if content_length and content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:\n        return JSONResponse(status_code=413, content={"detail": "Request too large"})\n    response = await call_next(request)\n    response.headers["X-Content-Type-Options"] = "nosniff"\n    response.headers["X-Frame-Options"] = "DENY"\n    response.headers["Referrer-Policy"] = "no-referrer"\n    return response\n\n@app.get("/health/live")\ndef live():\n    return {"ok": True}\n\n@app.get("/health/ready")\ndef readiness():\n    return {"ok": ready}\n\nif __name__ == "__main__":\n    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))\n',
    ".env.example": "PORT=8000\nLOG_LEVEL=info\n",
  };
}

function pythonAgentShell(): ScaffoldFiles {
  const service = pythonServiceShell();
  return {
    ...service,
    "requirements.txt": service["requirements.txt"] + "httpx>=0.27,<1\n",
    "app/agent.py":
      'import json\nimport os\nfrom datetime import datetime, timezone\n\nimport httpx\n\n\nclass AgentConfigError(RuntimeError):\n    pass\n\n\ndef current_time(_args: dict) -> str:\n    return datetime.now(timezone.utc).isoformat()\n\n\nTOOLS = {\n    "current_time": (\n        current_time,\n        {"type": "object", "properties": {}, "additionalProperties": False},\n        "Returns the current UTC time as an ISO-8601 string.",\n    ),\n}\n\n\nasync def run_agent(user_input: str, system_prompt: str) -> dict:\n    api_key = os.getenv("OPENAI_API_KEY")\n    if not api_key:\n        raise AgentConfigError("OPENAI_API_KEY is not configured")\n    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")\n    model = os.getenv("AGENT_MODEL", "gpt-4o-mini")\n    max_steps = max(1, int(os.getenv("AGENT_MAX_STEPS", "6")))\n    messages = [\n        {"role": "system", "content": system_prompt},\n        {"role": "user", "content": user_input},\n    ]\n    tool_specs = [\n        {"type": "function", "function": {"name": name, "description": desc, "parameters": params}}\n        for name, (_fn, params, desc) in TOOLS.items()\n    ]\n    async with httpx.AsyncClient(timeout=60) as client:\n        for step in range(1, max_steps + 1):\n            response = await client.post(\n                f"{base_url}/chat/completions",\n                headers={"authorization": f"Bearer {api_key}"},\n                json={"model": model, "messages": messages, "tools": tool_specs},\n            )\n            response.raise_for_status()\n            message = response.json()["choices"][0]["message"]\n            messages.append(message)\n            calls = message.get("tool_calls") or []\n            if not calls:\n                return {"output": message.get("content") or "", "steps": step}\n            for call in calls:\n                name = call["function"]["name"]\n                entry = TOOLS.get(name)\n                try:\n                    args = json.loads(call["function"].get("arguments") or "{}")\n                    result = entry[0](args) if entry else f"Unknown tool {name}"\n                except Exception as error:  # tool failures are reported to the model\n                    result = f"Tool error: {error}"\n                messages.append({"role": "tool", "tool_call_id": call["id"], "content": result})\n    raise RuntimeError(f"Agent stopped after {max_steps} steps without a final answer")\n',
    ".env.example":
      "PORT=8000\nOPENAI_API_KEY=\nOPENAI_BASE_URL=https://api.openai.com/v1\nAGENT_MODEL=gpt-4o-mini\nAGENT_MAX_STEPS=6\n",
  };
}

function reactNativeShell(): ScaffoldFiles {
  return {
    "package.json": json({
      name: "appforge-mobile",
      private: true,
      version: "0.1.0",
      main: "expo/AppEntry.js",
      scripts: { start: "expo start", build: "expo export" },
      dependencies: {
        expo: "^52.0.0",
        react: "^18.3.1",
        "react-native": "^0.76.0",
      },
      devDependencies: { typescript: "^5.6.0" },
    }),
    "app.json": json({
      expo: { name: "Application", slug: "generated-app" },
    }),
    "tsconfig.json": json({
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
      },
      include: ["App.tsx", "src"],
    }),
    "App.tsx":
      'import { SafeAreaView } from "react-native";\nexport default function App(){return <SafeAreaView />}\n',
    ".env.example":
      "# Expo inlines EXPO_PUBLIC_ variables into the app bundle; never put secrets here.\nEXPO_PUBLIC_API_URL=\n",
  };
}

function flutterShell(): ScaffoldFiles {
  return {
    "pubspec.yaml":
      'name: appforge_mobile\ndescription: Generated Flutter application\npublish_to: "none"\nenvironment:\n  sdk: ">=3.4.0 <4.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n',
    "lib/main.dart":
      'import "package:flutter/material.dart";\nvoid main()=>runApp(const App());\nclass App extends StatelessWidget{const App({super.key});@override Widget build(BuildContext context)=>const MaterialApp(home:SizedBox.shrink());}\n',
    ".env.example":
      "# Pass values with flutter run --dart-define=API_BASE_URL=...; never ship secrets in the app.\nAPI_BASE_URL=\n",
  };
}

function electronShell(): ScaffoldFiles {
  return {
    ...viteReactShell("Desktop Application"),
    "package.json": json({
      name: "appforge-electron",
      private: true,
      version: "0.1.0",
      main: "dist-electron/main.js",
      scripts: {
        dev: "vite",
        build: "vite build && tsc -p electron/tsconfig.json",
        start: "electron .",
      },
      dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
      devDependencies: {
        electron: "^33.0.0",
        typescript: "^5.6.0",
        vite: "^5.4.0",
        "@vitejs/plugin-react": "^4.3.0",
        "@types/react": "^18.3.0",
        "@types/react-dom": "^18.3.0",
      },
    }),
    "electron/main.ts":
      'import { app, BrowserWindow } from "electron";\napp.whenReady().then(()=>{const win=new BrowserWindow({width:1200,height:800});void win.loadFile("dist/index.html");});\n',
    "electron/tsconfig.json": json({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "../dist-electron",
      },
      include: ["main.ts"],
    }),
  };
}

function tauriShell(): ScaffoldFiles {
  const web = viteReactShell("Desktop Application");
  const pkg = JSON.parse(web["package.json"]);
  pkg.scripts = { ...pkg.scripts, tauri: "tauri" };
  pkg.devDependencies = {
    ...pkg.devDependencies,
    "@tauri-apps/cli": "^2.0.0",
  };
  web["package.json"] = json(pkg);
  return {
    ...web,
    "src-tauri/Cargo.toml":
      '[package]\nname="appforge_tauri"\nversion="0.1.0"\nedition="2021"\n[dependencies]\ntauri={version="2"}\n',
    "src-tauri/src/main.rs":
      '#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]\nfn main(){tauri::Builder::default().run(tauri::generate_context!()).expect("tauri runtime error");}\n',
    "src-tauri/tauri.conf.json": json({
      productName: "Desktop Application",
      version: "0.1.0",
      build: { frontendDist: "../dist", devUrl: "http://localhost:5173" },
    }),
  };
}

function extensionShell(): ScaffoldFiles {
  return {
    "package.json": json({
      name: "appforge-extension",
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        build: "tsc -p tsconfig.json",
        typecheck: "tsc -p tsconfig.json --noEmit",
      },
      devDependencies: { "@types/chrome": "^0.3.0", typescript: "^5.6.0" },
    }),
    "tsconfig.json": json({
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        lib: ["ES2020", "DOM"],
        types: ["chrome"],
      },
      include: ["src"],
    }),
    "manifest.json": json({
      manifest_version: 3,
      name: "Browser Extension",
      version: "0.1.0",
      background: { service_worker: "dist/background.js", type: "module" },
      permissions: ["storage"],
    }),
    "src/background.ts":
      'chrome.runtime.onInstalled.addListener(()=>console.info("installed"));\n',
    ".env.example":
      "# Extensions ship no server environment; store user settings with chrome.storage.\n# Build: npm run build, then load this folder unpacked in chrome://extensions.\n",
  };
}

export function getStackScaffold(
  techStack: string,
  productType?: ProductType,
): ScaffoldFiles {
  const adapter = productType
    ? assertStackSupportsProduct(techStack, productType)
    : getStackAdapter(techStack);
  let files: ScaffoldFiles;
  switch (adapter.id) {
    case "react-node":
    case "data-visualization":
      files = viteReactShell();
      break;
    case "static-html":
      files = staticShell();
      break;
    case "next-node":
      files = nextShell();
      break;
    case "phaser-html5":
      files = phaserShell();
      break;
    case "three-js-3d":
      files = threeShell();
      break;
    case "api-service":
      files = nodeServiceShell({
        name: "appforge-api-service",
        entry: "src/server.ts",
        env: "PORT=3000\nCORS_ORIGIN=\nDATABASE_URL=\nLOG_LEVEL=info\n",
      });
      break;
    case "node-service":
      files = nodeServiceShell({
        name: "appforge-node-service",
        entry: "src/index.ts",
        env: "PORT=3000\nLOG_LEVEL=info\n",
      });
      break;
    case "ai-agent-node":
      files = nodeServiceShell({
        name: "appforge-ai-agent",
        entry: "src/index.ts",
        env: "PORT=3000\nOPENAI_API_KEY=\nOPENAI_BASE_URL=https://api.openai.com/v1\nAGENT_MODEL=gpt-4o-mini\nAGENT_MAX_STEPS=6\n",
        imports: 'import { AgentConfigError, runAgent } from "./agent.js";\n',
        routes: `app.post("/agent/run", async (req, res) => {
  const input = typeof req.body?.input === "string" ? req.body.input.trim() : "";
  if (!input) return res.status(400).json({ error: "input is required" });
  try {
    res.json(await runAgent(input, "You are a helpful agent. Use tools when they help."));
  } catch (error) {
    const status = error instanceof AgentConfigError ? 503 : 502;
    res.status(status).json({ error: error instanceof Error ? error.message : "Agent failed" });
  }
});
`,
        extraFiles: AI_AGENT_NODE_FILES,
      });
      break;
    case "browser-automation":
      files = nodeServiceShell({
        name: "appforge-browser-automation",
        entry: "src/index.ts",
        env: "PORT=3000\nAUTOMATION_ALLOWED_HOSTS=\nAUTOMATION_TIMEOUT_MS=30000\n",
        dependencies: { playwright: PLAYWRIGHT_VERSION },
        imports:
          'import { AutomationPolicyError, capturePage } from "./automation.js";\n',
        routes: `app.post("/run", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    res.json(await capturePage(url));
  } catch (error) {
    const status = error instanceof AutomationPolicyError ? 400 : 502;
    res.status(status).json({ error: error instanceof Error ? error.message : "Automation failed" });
  }
});
`,
        extraFiles: BROWSER_AUTOMATION_FILES,
      });
      break;
    case "python-service":
      files = pythonServiceShell();
      break;
    case "ai-agent-python":
      files = pythonAgentShell();
      break;
    case "react-native-expo":
      files = reactNativeShell();
      break;
    case "flutter-firebase":
      files = flutterShell();
      break;
    case "electron-react":
      files = electronShell();
      break;
    case "tauri-rust":
      files = tauriShell();
      break;
    case "chrome-extension":
      files = extensionShell();
      break;
    default:
      throw new Error(
        `No scaffold implementation for stack adapter ${adapter.id}`,
      );
  }
  return withStackMetadata(
    adapter.id,
    ensureGeneratedProjectStructure(files, adapter.id),
  );
}

export function validateStackScaffold(
  techStack: string,
  scaffold: ScaffoldFiles,
): string[] {
  const adapter = getStackAdapter(techStack);
  const problems: string[] = [];

  if (!(adapter.dependencyManifest in scaffold)) {
    problems.push(`missing dependency manifest ${adapter.dependencyManifest}`);
  }

  for (const entrypoint of adapter.entrypoints) {
    if (!(entrypoint in scaffold)) {
      problems.push(`missing scaffold entrypoint ${entrypoint}`);
    }
  }

  for (const envFile of adapter.environmentFiles) {
    if (!(envFile in scaffold)) {
      problems.push(`missing environment/config file ${envFile}`);
    }
  }

  const stackMeta = scaffold["appforge.stack.json"];
  const previewMeta = scaffold["appforge.preview.json"];
  const deployMeta = scaffold["appforge.deploy.json"];
  const runtimeMeta = scaffold["appforge.runtime.json"];
  if (!stackMeta) problems.push("missing appforge.stack.json");
  if (!previewMeta) problems.push("missing appforge.preview.json");
  if (!deployMeta) problems.push("missing appforge.deploy.json");
  if (!runtimeMeta) problems.push("missing appforge.runtime.json");

  try {
    if (stackMeta) {
      const parsed = JSON.parse(stackMeta) as Record<string, unknown>;
      if (parsed.stack !== adapter.id)
        problems.push("stack metadata id mismatch");
      if (parsed.runtime !== adapter.runtime)
        problems.push("stack metadata runtime mismatch");
      if (parsed.outputDirectory !== adapter.outputDirectory)
        problems.push("stack metadata output directory mismatch");
    }
    if (previewMeta) {
      const parsed = JSON.parse(previewMeta) as Record<string, unknown>;
      if (parsed.mode !== adapter.previewMode)
        problems.push("preview metadata mode mismatch");
    }
    if (runtimeMeta) {
      const parsed = JSON.parse(runtimeMeta) as Record<string, unknown>;
      const expected = getRuntimeArchitecture(adapter.id);
      if (JSON.stringify(parsed) !== JSON.stringify(expected)) {
        problems.push("runtime metadata mismatch");
      }
    }
    if (deployMeta) {
      const parsed = JSON.parse(deployMeta) as {
        targets?: unknown;
        buildCommand?: unknown;
        startCommand?: unknown;
      };
      if (
        JSON.stringify(parsed.targets) !==
        JSON.stringify(adapter.deploymentTargets)
      ) {
        problems.push("deployment metadata targets mismatch");
      }
      if (parsed.buildCommand !== adapter.buildCommand)
        problems.push("deployment metadata build command mismatch");
      if (parsed.startCommand !== adapter.startCommand)
        problems.push("deployment metadata start command mismatch");
    }
  } catch {
    problems.push("invalid scaffold metadata JSON");
  }

  problems.push(...validateGeneratedProjectStructure(scaffold, adapter.id));

  const visiblePlaceholder = Object.entries(scaffold)
    .filter(([path]) => !path.endsWith(".json"))
    .some(([, source]) =>
      /Scaffold is ready|Your generated UI will replace this screen|Generated product|Coming soon/i.test(
        source,
      ),
    );
  if (visiblePlaceholder) {
    problems.push("placeholder scaffold language detected");
  }

  return [...new Set(problems)];
}

function mergePackageManifest(
  scaffoldPackage: string,
  generatedPackage: string,
): string {
  try {
    const base = JSON.parse(scaffoldPackage) as Record<string, unknown>;
    const current = JSON.parse(generatedPackage) as Record<string, unknown>;
    const mergeRecord = (
      baseValue: unknown,
      currentValue: unknown,
    ): Record<string, unknown> => ({
      ...((baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
        ? baseValue
        : {}) as Record<string, unknown>),
      ...((currentValue &&
      typeof currentValue === "object" &&
      !Array.isArray(currentValue)
        ? currentValue
        : {}) as Record<string, unknown>),
    });

    return json({
      ...base,
      ...current,
      scripts: mergeRecord(base.scripts, current.scripts),
      dependencies: mergeRecord(base.dependencies, current.dependencies),
      devDependencies: mergeRecord(
        base.devDependencies,
        current.devDependencies,
      ),
    });
  } catch {
    return generatedPackage;
  }
}

export function mergeScaffoldWithGenerated(
  scaffold: ScaffoldFiles,
  generated: ScaffoldFiles,
  techStack?: string,
): ScaffoldFiles {
  const out: ScaffoldFiles = { ...generated };

  for (const [filePath, content] of Object.entries(scaffold)) {
    if (
      filePath === "package.json" &&
      typeof generated[filePath] === "string"
    ) {
      out[filePath] = mergePackageManifest(content, generated[filePath]);
      continue;
    }
    if (filePath in generated) continue;
    if (techStack && isProductImplementationPath(techStack, filePath)) {
      continue;
    }
    if (typeof content === "string" && content.trim()) {
      out[filePath] = content;
    }
  }

  return out;
}

export default { getStackScaffold, mergeScaffoldWithGenerated };
