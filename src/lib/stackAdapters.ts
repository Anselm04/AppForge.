import type { ProductType } from "./productContract.js";

export type StackGenerationMode = "runnable" | "structural";
export type StackPreviewMode =
  | "static"
  | "vite"
  | "next"
  | "service"
  | "mobile"
  | "desktop"
  | "extension"
  | "source";
export type StackRuntime =
  "browser" | "node" | "python" | "mobile" | "desktop" | "extension";

export type StackAdapter = {
  id: string;
  label: string;
  aliases: string[];
  productTypes: ProductType[];
  generationMode: StackGenerationMode;
  runtime: StackRuntime;
  entrypoints: string[];
  dependencyManifest: string;
  environmentFiles: string[];
  projectStructure: string[];
  buildCommand: string | null;
  startCommand: string | null;
  previewMode: StackPreviewMode;
  deploymentTargets: string[];
  outputDirectory: string | null;
  artifactKind:
    | "web"
    | "static"
    | "service"
    | "mobile"
    | "desktop"
    | "game"
    | "extension"
    | "automation"
    | "data";
};

const A = (adapter: StackAdapter): StackAdapter => adapter;

export const STACK_ADAPTERS: readonly StackAdapter[] = [
  A({
    id: "react-node",
    label: "React + Node",
    aliases: ["react", "react vite", "vite react", "web app"],
    productTypes: [
      "website",
      "saas_application",
      "ecommerce_product",
      "developer_tool",
    ],
    generationMode: "runnable",
    runtime: "node",
    entrypoints: ["src/main.tsx", "src/App.tsx"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["src/", "public/"],
    buildCommand: "npm run build",
    startCommand: "npm run start",
    previewMode: "vite",
    deploymentTargets: ["vercel", "netlify", "fly", "preview"],
    outputDirectory: "dist",
    artifactKind: "web",
  }),
  A({
    id: "static-html",
    label: "Static HTML/CSS/JavaScript",
    aliases: [
      "static website",
      "static site",
      "html css javascript",
      "vanilla website",
    ],
    productTypes: ["website"],
    generationMode: "runnable",
    runtime: "browser",
    entrypoints: ["index.html"],
    dependencyManifest: "package.json",
    environmentFiles: [],
    projectStructure: ["assets/"],
    buildCommand: "npm run build",
    startCommand: null,
    previewMode: "static",
    deploymentTargets: ["vercel", "netlify", "github-pages", "fly", "preview"],
    outputDirectory: "dist",
    artifactKind: "static",
  }),
  A({
    id: "next-node",
    label: "Next.js + Node",
    aliases: ["next", "nextjs", "next.js"],
    productTypes: [
      "website",
      "saas_application",
      "ecommerce_product",
      "developer_tool",
    ],
    generationMode: "runnable",
    runtime: "node",
    entrypoints: ["app/page.tsx", "app/layout.tsx"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["app/", "public/"],
    buildCommand: "npm run build",
    startCommand: "npm run start",
    previewMode: "next",
    deploymentTargets: ["vercel", "fly", "preview"],
    outputDirectory: ".next",
    artifactKind: "web",
  }),
  A({
    id: "phaser-html5",
    label: "Phaser HTML5",
    aliases: ["phaser", "phaser game"],
    productTypes: ["game"],
    generationMode: "runnable",
    runtime: "browser",
    entrypoints: ["src/main.ts"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["src/", "public/"],
    buildCommand: "npm run build",
    startCommand: null,
    previewMode: "vite",
    deploymentTargets: ["vercel", "netlify", "fly", "preview"],
    outputDirectory: "dist",
    artifactKind: "game",
  }),
  A({
    id: "three-js-3d",
    label: "Three.js",
    aliases: ["three", "threejs", "three.js", "webgl"],
    productTypes: ["game", "website", "data_product"],
    generationMode: "runnable",
    runtime: "browser",
    entrypoints: ["src/main.ts"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["src/", "public/"],
    buildCommand: "npm run build",
    startCommand: null,
    previewMode: "vite",
    deploymentTargets: ["vercel", "netlify", "fly", "preview"],
    outputDirectory: "dist",
    artifactKind: "game",
  }),
  A({
    id: "react-native-expo",
    label: "React Native + Expo",
    aliases: ["react native", "expo", "expo react native"],
    productTypes: ["mobile_app"],
    generationMode: "structural",
    runtime: "mobile",
    entrypoints: ["App.tsx"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example", "app.json"],
    projectStructure: ["src/", "assets/"],
    buildCommand: "npx expo export",
    startCommand: "npx expo start",
    previewMode: "mobile",
    deploymentTargets: ["expo-eas"],
    outputDirectory: "dist",
    artifactKind: "mobile",
  }),
  A({
    id: "flutter-firebase",
    label: "Flutter + Firebase",
    aliases: ["flutter", "flutter firebase"],
    productTypes: ["mobile_app"],
    generationMode: "structural",
    runtime: "mobile",
    entrypoints: ["lib/main.dart"],
    dependencyManifest: "pubspec.yaml",
    environmentFiles: [".env.example"],
    projectStructure: ["lib/", "assets/", "test/"],
    buildCommand: "flutter build appbundle",
    startCommand: "flutter run",
    previewMode: "mobile",
    deploymentTargets: ["google-play", "apple-app-store"],
    outputDirectory: "build/",
    artifactKind: "mobile",
  }),
  A({
    id: "electron-react",
    label: "Electron + React",
    aliases: ["electron", "electron react"],
    productTypes: ["desktop_app"],
    generationMode: "structural",
    runtime: "desktop",
    entrypoints: ["electron/main.ts", "src/main.tsx"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["electron/", "src/"],
    buildCommand: "npm run build",
    startCommand: "npm run start",
    previewMode: "desktop",
    deploymentTargets: ["desktop-package"],
    outputDirectory: "release/",
    artifactKind: "desktop",
  }),
  A({
    id: "tauri-rust",
    label: "Tauri + Rust",
    aliases: ["tauri", "tauri rust"],
    productTypes: ["desktop_app"],
    generationMode: "structural",
    runtime: "desktop",
    entrypoints: ["src-tauri/src/main.rs", "src/main.tsx"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example", "src-tauri/tauri.conf.json"],
    projectStructure: ["src/", "src-tauri/"],
    buildCommand: "npm run tauri build",
    startCommand: "npm run tauri dev",
    previewMode: "desktop",
    deploymentTargets: ["desktop-package"],
    outputDirectory: "src-tauri/target/release/",
    artifactKind: "desktop",
  }),
  A({
    id: "api-service",
    label: "Node API Service",
    aliases: ["api", "rest api", "node api"],
    productTypes: ["api", "developer_tool"],
    generationMode: "runnable",
    runtime: "node",
    entrypoints: ["src/server.ts"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["src/", "test/"],
    buildCommand: "npm run build",
    startCommand: "npm run start",
    previewMode: "service",
    deploymentTargets: ["fly", "vercel"],
    outputDirectory: "dist",
    artifactKind: "service",
  }),
  A({
    id: "node-service",
    label: "Node.js Service",
    aliases: [
      "node service",
      "nodejs service",
      "node.js service",
      "node backend",
    ],
    productTypes: ["api", "automation_tool", "developer_tool"],
    generationMode: "runnable",
    runtime: "node",
    entrypoints: ["src/index.ts"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["src/", "test/"],
    buildCommand: "npm run build",
    startCommand: "npm run start",
    previewMode: "service",
    deploymentTargets: ["fly", "vercel"],
    outputDirectory: "dist",
    artifactKind: "service",
  }),
  A({
    id: "python-service",
    label: "Python Service",
    aliases: ["python", "python api", "python service", "fastapi"],
    productTypes: [
      "api",
      "automation_tool",
      "developer_tool",
      "data_product",
      "ai_agent",
    ],
    generationMode: "structural",
    runtime: "python",
    entrypoints: ["app/main.py"],
    dependencyManifest: "requirements.txt",
    environmentFiles: [".env.example"],
    projectStructure: ["app/", "tests/"],
    buildCommand: "python -m compileall app",
    startCommand: "python -m app.main",
    previewMode: "service",
    deploymentTargets: ["fly"],
    outputDirectory: null,
    artifactKind: "service",
  }),
  A({
    id: "ai-agent-node",
    label: "Node AI Agent",
    aliases: ["ai agent node", "node ai agent", "agent node"],
    productTypes: ["ai_agent"],
    generationMode: "runnable",
    runtime: "node",
    entrypoints: ["src/index.ts"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["src/", "test/"],
    buildCommand: "npm run build",
    startCommand: "npm run start",
    previewMode: "service",
    deploymentTargets: ["fly"],
    outputDirectory: "dist",
    artifactKind: "service",
  }),
  A({
    id: "ai-agent-python",
    label: "Python AI Agent",
    aliases: ["python ai agent", "ai agent python"],
    productTypes: ["ai_agent"],
    generationMode: "structural",
    runtime: "python",
    entrypoints: ["app/main.py"],
    dependencyManifest: "requirements.txt",
    environmentFiles: [".env.example"],
    projectStructure: ["app/", "tests/"],
    buildCommand: "python -m compileall app",
    startCommand: "python -m app.main",
    previewMode: "service",
    deploymentTargets: ["fly"],
    outputDirectory: null,
    artifactKind: "service",
  }),
  A({
    id: "chrome-extension",
    label: "Browser Extension (Manifest V3)",
    aliases: ["browser extension", "chrome extension", "manifest v3", "mv3"],
    productTypes: ["browser_extension"],
    generationMode: "structural",
    runtime: "extension",
    entrypoints: ["manifest.json", "src/background.ts"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["src/", "icons/"],
    buildCommand: "npm run build",
    startCommand: null,
    previewMode: "extension",
    deploymentTargets: ["chrome-web-store"],
    outputDirectory: "dist",
    artifactKind: "extension",
  }),
  A({
    id: "browser-automation",
    label: "Browser Automation",
    aliases: ["automation", "browser automation", "playwright automation"],
    productTypes: ["automation_tool"],
    generationMode: "runnable",
    runtime: "node",
    entrypoints: ["src/index.ts"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["src/", "test/"],
    buildCommand: "npm run build",
    startCommand: "npm run start",
    previewMode: "service",
    deploymentTargets: ["fly"],
    outputDirectory: "dist",
    artifactKind: "automation",
  }),
  A({
    id: "data-visualization",
    label: "Data Product",
    aliases: ["data visualization", "data dashboard", "analytics dashboard"],
    productTypes: ["data_product"],
    generationMode: "runnable",
    runtime: "browser",
    entrypoints: ["src/main.tsx"],
    dependencyManifest: "package.json",
    environmentFiles: [".env.example"],
    projectStructure: ["src/", "public/"],
    buildCommand: "npm run build",
    startCommand: null,
    previewMode: "vite",
    deploymentTargets: ["vercel", "netlify", "fly", "preview"],
    outputDirectory: "dist",
    artifactKind: "data",
  }),
];

const BY_ID = new Map(STACK_ADAPTERS.map((adapter) => [adapter.id, adapter]));
const BY_ALIAS = new Map<string, StackAdapter>();
for (const adapter of STACK_ADAPTERS) {
  BY_ALIAS.set(adapter.id, adapter);
  BY_ALIAS.set(adapter.label.toLowerCase(), adapter);
  for (const alias of adapter.aliases)
    BY_ALIAS.set(alias.toLowerCase(), adapter);
}

export function getStackAdapter(stackId: string): StackAdapter {
  const normalized = stackId.trim().toLowerCase();
  const adapter = BY_ID.get(normalized) ?? BY_ALIAS.get(normalized);
  if (!adapter) {
    throw new Error(`Unsupported technology stack: ${stackId}`);
  }
  return adapter;
}

export function normalizeStackId(stackId: string): string {
  return getStackAdapter(stackId).id;
}

export function isSupportedStack(stackId: string): boolean {
  try {
    getStackAdapter(stackId);
    return true;
  } catch {
    return false;
  }
}

export function assertStackSupportsProduct(
  stackId: string,
  productType: ProductType,
): StackAdapter {
  const adapter = getStackAdapter(stackId);
  if (!adapter.productTypes.includes(productType)) {
    throw new Error(
      `Technology stack ${adapter.id} does not support product type ${productType}`,
    );
  }
  return adapter;
}

export function isStructuralOnlyStack(stackId: string): boolean {
  return getStackAdapter(stackId).generationMode === "structural";
}
