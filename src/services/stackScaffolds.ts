import { getStackAdapter } from "../lib/stackAdapters.js";

/** Stack-shaped infrastructure shells. Generated product logic must overwrite/add substantive files. */
export type ScaffoldFiles = Record<string, string>;

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function viteReactShell(title = "AppForge App"): ScaffoldFiles {
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
    "src/App.tsx": `export function App(){return <main><h1>${title}</h1></main>;}
`,
    ".env.example": "",
    ".gitignore": "node_modules\ndist\n.env\n",
  };
}

function staticShell(title = "AppForge Site"): ScaffoldFiles {
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
    "assets/main.js":
      'document.querySelector("#app").textContent = "AppForge static site";\n',
    "assets/styles.css": "",
    ".gitignore": "node_modules\ndist\n",
  };
}

function nextShell(title = "AppForge App"): ScaffoldFiles {
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
    "app/page.tsx": `export default function Page(){return <main><h1>${title}</h1></main>}\n`,
    ".env.example": "",
  };
}

function phaserShell(title = "AppForge Game"): ScaffoldFiles {
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
    "index.html": `<!doctype html><html><body><main id="game"></main><script type="module" src="/src/main.ts"></script></body></html>`,
    "src/main.ts": `import Phaser from "phaser";
class MainScene extends Phaser.Scene {
  constructor(){ super("main"); }
  create(){ this.add.text(24,24,"${title}"); }
}
new Phaser.Game({ type: Phaser.AUTO, parent: "game", width: 960, height: 540, scene: [MainScene] });
`,
    ".env.example": "",
  };
}

function threeShell(title = "AppForge 3D"): ScaffoldFiles {
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
console.info("${title}");
`,
    ".env.example": "",
  };
}

function nodeServiceShell(entry = "src/index.ts"): ScaffoldFiles {
  return {
    "package.json": json({
      name: "appforge-node-service",
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        build: "tsc -p tsconfig.json",
        start: "node dist/index.js",
        typecheck: "tsc --noEmit",
      },
      dependencies: { express: "^5.1.0" },
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
const app = express();
app.get("/health", (_req,res) => res.json({ ok: true }));
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log("listening on " + port));
`,
    ".env.example": "PORT=3000\n",
  };
}

function pythonServiceShell(): ScaffoldFiles {
  return {
    "requirements.txt": "fastapi>=0.116,<1\nuvicorn[standard]>=0.35,<1\n",
    "app/__init__.py": "",
    "app/main.py":
      'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/health")\ndef health():\n    return {"ok": True}\n',
    ".env.example": "PORT=8000\n",
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
      expo: { name: "AppForge Mobile", slug: "appforge-mobile" },
    }),
    "App.tsx":
      'import { SafeAreaView, Text } from "react-native";\nexport default function App(){return <SafeAreaView><Text>AppForge Mobile</Text></SafeAreaView>}\n',
    ".env.example": "",
  };
}

function flutterShell(): ScaffoldFiles {
  return {
    "pubspec.yaml":
      'name: appforge_mobile\ndescription: AppForge generated Flutter application\npublish_to: "none"\nenvironment:\n  sdk: ">=3.4.0 <4.0.0"\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n',
    "lib/main.dart":
      'import "package:flutter/material.dart";\nvoid main()=>runApp(const App());\nclass App extends StatelessWidget{const App({super.key});@override Widget build(BuildContext context)=>const MaterialApp(home:Scaffold(body:Center(child:Text("AppForge Mobile"))));}\n',
    ".env.example": "",
  };
}

function electronShell(): ScaffoldFiles {
  return {
    ...viteReactShell("AppForge Desktop"),
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
  return {
    ...viteReactShell("AppForge Tauri"),
    "src-tauri/Cargo.toml":
      '[package]\nname="appforge_tauri"\nversion="0.1.0"\nedition="2021"\n[dependencies]\ntauri={version="2"}\n',
    "src-tauri/src/main.rs":
      '#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]\nfn main(){tauri::Builder::default().run(tauri::generate_context!()).expect("tauri runtime error");}\n',
    "src-tauri/tauri.conf.json": json({
      productName: "AppForge Tauri",
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
      scripts: { build: "tsc --noEmit && vite build" },
      devDependencies: { typescript: "^5.6.0", vite: "^5.4.0" },
    }),
    "manifest.json": json({
      manifest_version: 3,
      name: "AppForge Extension",
      version: "0.1.0",
      background: { service_worker: "dist/background.js", type: "module" },
      permissions: ["storage"],
    }),
    "src/background.ts":
      'chrome.runtime.onInstalled.addListener(()=>console.info("installed"));\n',
    ".env.example": "",
  };
}

export function getStackScaffold(techStack: string): ScaffoldFiles {
  const adapter = getStackAdapter(techStack);
  switch (adapter.id) {
    case "react-node":
    case "data-visualization":
      return viteReactShell();
    case "static-html":
      return staticShell();
    case "next-node":
      return nextShell();
    case "phaser-html5":
      return phaserShell();
    case "three-js-3d":
      return threeShell();
    case "api-service":
    case "node-service":
    case "ai-agent-node":
    case "browser-automation":
      return nodeServiceShell(
        adapter.id === "api-service" ? "src/server.ts" : "src/index.ts",
      );
    case "python-service":
    case "ai-agent-python":
      return pythonServiceShell();
    case "react-native-expo":
      return reactNativeShell();
    case "flutter-firebase":
      return flutterShell();
    case "electron-react":
      return electronShell();
    case "tauri-rust":
      return tauriShell();
    case "chrome-extension":
      return extensionShell();
    default:
      throw new Error(
        `No scaffold implementation for stack adapter ${adapter.id}`,
      );
  }
}

export function mergeScaffoldWithGenerated(
  scaffold: ScaffoldFiles,
  generated: ScaffoldFiles,
): ScaffoldFiles {
  const out: ScaffoldFiles = { ...scaffold };
  for (const [filePath, content] of Object.entries(generated)) {
    if (typeof content === "string" && content.trim()) out[filePath] = content;
  }
  return out;
}

export default { getStackScaffold, mergeScaffoldWithGenerated };
