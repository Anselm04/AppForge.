import { builtinModules } from "node:module";
import { posix } from "node:path";
import { getStackAdapter } from "./stackAdapters.js";

export type GeneratedProjectStructurePolicy = {
  version: 1;
  stack: string;
  runtime: string;
  packageManager: "npm" | "flutter" | "pip" | "cargo";
  lockfile: string | null;
  lockfileRequiredAfterInstall: boolean;
  routingBoundary: string;
  apiBoundary: string | null;
  databaseBoundary: string | null;
  assetRoots: string[];
  requiredConfigFiles: string[];
  requiredDocumentation: string[];
  buildCommand: string | null;
  startCommand: string | null;
  deploymentTargets: string[];
};

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
];

const NODE_BUILTINS = new Set(
  builtinModules.flatMap((name) => [name, name.replace(/^node:/, ""), `node:${name}`]),
);

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function isSafeProjectPath(path: string): boolean {
  if (!path || path.includes("\0") || path.includes("\\")) return false;
  if (path.startsWith("/") || /^[A-Za-z]:\//.test(path)) return false;
  const normalized = posix.normalize(path);
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized !== path.replace(/^\.\//, "")
  ) {
    return false;
  }
  return !path.split("/").some((segment) => segment === ".." || segment === "");
}

function packageManagerFor(stack: string): GeneratedProjectStructurePolicy["packageManager"] {
  const adapter = getStackAdapter(stack);
  if (adapter.dependencyManifest === "pubspec.yaml") return "flutter";
  if (adapter.dependencyManifest === "requirements.txt") return "pip";
  if (adapter.dependencyManifest.endsWith("Cargo.toml")) return "cargo";
  return "npm";
}

function requiredConfigFiles(stack: string): string[] {
  const adapter = getStackAdapter(stack);
  const files = new Set<string>(adapter.environmentFiles);
  if (adapter.dependencyManifest === "package.json") {
    if (
      adapter.runtime === "node" ||
      adapter.id.includes("react") ||
      ["next-node", "phaser-html5", "three-js-3d", "data-visualization", "electron-react", "tauri-rust", "chrome-extension"].includes(adapter.id)
    ) {
      files.add("tsconfig.json");
    }
    if (
      ["react-node", "phaser-html5", "three-js-3d", "data-visualization", "electron-react", "tauri-rust"].includes(adapter.id)
    ) {
      files.add("vite.config.ts");
    }
  }
  if (adapter.id === "chrome-extension") files.add("manifest.json");
  if (adapter.id === "react-native-expo") files.add("app.json");
  if (adapter.id === "tauri-rust") {
    files.add("src-tauri/Cargo.toml");
    files.add("src-tauri/tauri.conf.json");
  }
  return [...files];
}

export function getGeneratedProjectStructurePolicy(
  stack: string,
): GeneratedProjectStructurePolicy {
  const adapter = getStackAdapter(stack);
  const packageManager = packageManagerFor(adapter.id);
  const webRouting = ["react-node", "data-visualization"].includes(adapter.id)
    ? "src/"
    : adapter.id === "next-node"
      ? "app/"
      : adapter.runtime === "browser"
        ? "/"
        : adapter.runtime === "mobile"
          ? adapter.id === "flutter-firebase"
            ? "lib/"
            : "src/"
          : adapter.runtime === "extension"
            ? "src/"
            : adapter.runtime === "desktop"
              ? "src/"
              : "none";

  const apiBoundary =
    adapter.runtime === "node"
      ? ["react-node", "next-node"].includes(adapter.id)
        ? "src/server/"
        : "src/"
      : adapter.runtime === "python"
        ? "app/"
        : null;

  const databaseBoundary =
    ["saas_application", "api", "automation_tool", "data_product"].some((type) =>
      adapter.productTypes.includes(type as never),
    )
      ? adapter.runtime === "python"
        ? "app/db/"
        : adapter.runtime === "node"
          ? "src/db/"
          : null
      : null;

  const assetRoots =
    adapter.id === "flutter-firebase"
      ? ["assets/"]
      : adapter.id === "react-native-expo"
        ? ["assets/"]
        : adapter.runtime === "browser" || adapter.id === "next-node"
          ? ["public/", "assets/", "src/assets/"]
          : adapter.runtime === "extension"
            ? ["icons/", "assets/"]
            : ["assets/"];

  return {
    version: 1,
    stack: adapter.id,
    runtime: adapter.runtime,
    packageManager,
    lockfile:
      packageManager === "npm"
        ? "package-lock.json"
        : packageManager === "flutter"
          ? "pubspec.lock"
          : packageManager === "cargo"
            ? "src-tauri/Cargo.lock"
            : null,
    lockfileRequiredAfterInstall: packageManager === "npm",
    routingBoundary: webRouting,
    apiBoundary,
    databaseBoundary,
    assetRoots,
    requiredConfigFiles: requiredConfigFiles(adapter.id),
    requiredDocumentation: ["README.md", "SECURITY.md", "LICENSE"],
    buildCommand: adapter.buildCommand,
    startCommand: adapter.startCommand,
    deploymentTargets: adapter.deploymentTargets,
  };
}

function defaultSecurityDoc(): string {
  return [
    "# Security",
    "",
    "Do not commit production secrets, tokens, private keys, or customer credentials.",
    "Configure runtime secrets through the deployment environment and validate all untrusted input.",
    "Report security issues privately to the product owner rather than through public issue content.",
    "",
  ].join("\n");
}

function defaultLicense(): string {
  return [
    "Copyright (c) AppForge project owner.",
    "",
    "All rights reserved unless the project owner replaces this file with an explicit license.",
    "",
  ].join("\n");
}

export function ensureGeneratedProjectStructure(
  inputFiles: Record<string, string>,
  stack: string,
): Record<string, string> {
  const files = { ...inputFiles };
  const policy = getGeneratedProjectStructurePolicy(stack);

  if (!files["README.md"]) {
    files["README.md"] = [
      "# Generated project",
      "",
      `Technology stack: ${policy.stack}`,
      `Runtime: ${policy.runtime}`,
      `Build: ${policy.buildCommand ?? "not applicable"}`,
      `Start: ${policy.startCommand ?? "not applicable"}`,
      "",
      "## Project boundaries",
      `Routing: ${policy.routingBoundary}`,
      `API: ${policy.apiBoundary ?? "not applicable"}`,
      `Database: ${policy.databaseBoundary ?? "not applicable"}`,
      `Assets: ${policy.assetRoots.join(", ")}`,
      "",
      "Copy environment examples to local runtime configuration and provide real secrets only through the deployment environment.",
      "",
    ].join("\n");
  }
  if (!files["SECURITY.md"]) files["SECURITY.md"] = defaultSecurityDoc();
  if (!files["LICENSE"]) files["LICENSE"] = defaultLicense();
  if (!files["appforge.structure.json"]) {
    files["appforge.structure.json"] = json(policy);
  }

  return files;
}

function npmPackageNameValid(name: unknown): boolean {
  if (typeof name !== "string" || name.length < 1 || name.length > 214) return false;
  if (name.startsWith(".") || name.startsWith("_")) return false;
  if (/[A-Z\s]/.test(name)) return false;
  return /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/.test(
    name,
  );
}

function majorOf(version: string | undefined): number | null {
  if (!version) return null;
  const match = version.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function packageNameFromSpecifier(specifier: string): string | null {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("#")
  ) {
    return null;
  }
  if (NODE_BUILTINS.has(specifier) || NODE_BUILTINS.has(specifier.replace(/^node:/, ""))) {
    return null;
  }
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split("/")[0];
}

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /^\s*import\s+["']([^"']+)["']/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) specs.push(match[1]);
    }
  }
  return [...new Set(specs)];
}

function isDevContext(path: string): boolean {
  return (
    /(?:^|\/)(?:__tests__|test|tests)\//i.test(path) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path) ||
    /(?:^|\/)(?:vite|vitest|jest|eslint|prettier|tailwind|postcss)\.config\.[cm]?[jt]s$/i.test(
      path,
    )
  );
}

function sourceCandidates(base: string): string[] {
  const candidates = [base];
  for (const ext of SOURCE_EXTENSIONS) candidates.push(base + ext);
  for (const ext of SOURCE_EXTENSIONS) candidates.push(posix.join(base, "index" + ext));
  return candidates;
}

function brokenRelativeImports(files: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const [path, source] of Object.entries(files)) {
    if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
    for (const specifier of importSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      const base = posix.normalize(posix.join(posix.dirname(path), specifier));
      if (!sourceCandidates(base).some((candidate) => candidate in files)) {
        problems.push(`${path}: broken relative import ${specifier}`);
      }
    }
  }
  return problems;
}

function dependencyProblems(
  files: Record<string, string>,
  stack: string,
): string[] {
  const raw = files["package.json"];
  if (!raw) return [];
  let pkg: {
    name?: unknown;
    version?: unknown;
    scripts?: Record<string, unknown>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(raw);
  } catch {
    return ["package.json is invalid JSON"];
  }

  const problems: string[] = [];
  if (!npmPackageNameValid(pkg.name)) problems.push("package.json has invalid package name");
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};

  for (const name of Object.keys(deps)) {
    if (name in devDeps && deps[name] !== devDeps[name]) {
      problems.push(`dependency ${name} is declared with conflicting runtime/dev versions`);
    }
  }

  const reactMajor = majorOf(deps.react);
  const reactDomMajor = majorOf(deps["react-dom"]);
  if (reactMajor && reactDomMajor && reactMajor !== reactDomMajor) {
    problems.push("react and react-dom major versions are incompatible");
  }
  const reactTypesMajor = majorOf(devDeps["@types/react"]);
  if (reactMajor && reactTypesMajor && reactMajor !== reactTypesMajor) {
    problems.push("react and @types/react major versions are incompatible");
  }
  const nextMajor = majorOf(deps.next);
  if (nextMajor === 14 && reactMajor && reactMajor !== 18) {
    problems.push("Next.js 14 scaffold requires React 18");
  }

  for (const [path, source] of Object.entries(files)) {
    if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
    for (const specifier of importSpecifiers(source)) {
      const packageName = packageNameFromSpecifier(specifier);
      if (!packageName) continue;
      if (isDevContext(path)) {
        if (!(packageName in devDeps) && !(packageName in deps)) {
          problems.push(`${path}: undeclared development dependency ${packageName}`);
        }
      } else if (
        !(packageName in deps) &&
        !(
          stack === "electron-react" &&
          packageName === "electron" &&
          packageName in devDeps
        )
      ) {
        problems.push(`${path}: missing runtime dependency ${packageName}`);
      }
    }
  }

  return problems;
}

function scriptProblems(
  files: Record<string, string>,
  stack: string,
): string[] {
  const policy = getGeneratedProjectStructurePolicy(stack);
  if (policy.packageManager !== "npm") return [];
  const raw = files["package.json"];
  if (!raw) return ["missing package.json"];
  try {
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    const problems: string[] = [];
    if (policy.buildCommand?.startsWith("npm run ")) {
      const script = policy.buildCommand
        .slice("npm run ".length)
        .trim()
        .split(/\s+/)[0];
      if (!scripts[script]) problems.push(`package.json missing required ${script} script`);
    }
    if (policy.startCommand?.startsWith("npm run ")) {
      const script = policy.startCommand
        .slice("npm run ".length)
        .trim()
        .split(/\s+/)[0];
      if (!scripts[script]) problems.push(`package.json missing required ${script} script`);
    }
    return problems;
  } catch {
    return ["package.json is invalid JSON"];
  }
}

function conflictingEntrypointProblems(
  files: Record<string, string>,
  stack: string,
): string[] {
  const conflicts: Record<string, string[][]> = {
    "react-node": [
      ["src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js"],
      ["src/App.tsx", "src/App.jsx", "src/App.ts", "src/App.js"],
    ],
    "data-visualization": [["src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js"]],
    "next-node": [["app/page.tsx", "pages/index.tsx", "pages/index.jsx"]],
    "api-service": [["src/server.ts", "src/index.ts"]],
    "node-service": [["src/index.ts", "src/server.ts"]],
    "ai-agent-node": [["src/index.ts", "src/server.ts"]],
  };
  const problems: string[] = [];
  for (const group of conflicts[stack] ?? []) {
    const present = group.filter((path) => path in files);
    if (present.length > 1) {
      problems.push(`conflicting entrypoints: ${present.join(", ")}`);
    }
  }
  return problems;
}

function lockfileProblems(files: Record<string, string>, stack: string): string[] {
  const policy = getGeneratedProjectStructurePolicy(stack);
  if (policy.packageManager !== "npm") return [];
  const locks = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"].filter(
    (path) => path in files,
  );
  if (locks.length > 1) return [`conflicting package-manager lockfiles: ${locks.join(", ")}`];
  if (!files["package-lock.json"]) return [];

  try {
    const pkg = JSON.parse(files["package.json"] ?? "{}") as {
      name?: string;
      version?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const lock = JSON.parse(files["package-lock.json"]) as {
      name?: string;
      version?: string;
      lockfileVersion?: number;
      packages?: Record<
        string,
        {
          name?: string;
          version?: string;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        }
      >;
    };
    const root = lock.packages?.[""];
    const problems: string[] = [];
    if (![2, 3].includes(lock.lockfileVersion ?? 0)) {
      problems.push("package-lock.json has unsupported lockfileVersion");
    }
    if (root) {
      if (root.name && pkg.name && root.name !== pkg.name) {
        problems.push("package-lock.json package name disagrees with package.json");
      }
      if (root.version && pkg.version && root.version !== pkg.version) {
        problems.push("package-lock.json package version disagrees with package.json");
      }
      if (
        JSON.stringify(root.dependencies ?? {}) !==
        JSON.stringify(pkg.dependencies ?? {})
      ) {
        problems.push("package-lock.json runtime dependencies are stale");
      }
      if (
        JSON.stringify(root.devDependencies ?? {}) !==
        JSON.stringify(pkg.devDependencies ?? {})
      ) {
        problems.push("package-lock.json development dependencies are stale");
      }
    }
    return problems;
  } catch {
    return ["package-lock.json is invalid JSON"];
  }
}

export function validateGeneratedProjectStructure(
  files: Record<string, string>,
  stack: string,
): string[] {
  const adapter = getStackAdapter(stack);
  const policy = getGeneratedProjectStructurePolicy(adapter.id);
  const problems: string[] = [];

  for (const path of Object.keys(files)) {
    if (!isSafeProjectPath(path)) problems.push(`unsafe project path escapes project directory: ${path}`);
  }

  if (!files[adapter.dependencyManifest]?.trim()) {
    problems.push(`missing dependency manifest ${adapter.dependencyManifest}`);
  }
  for (const entrypoint of adapter.entrypoints) {
    if (!files[entrypoint]?.trim()) problems.push(`missing runtime entrypoint ${entrypoint}`);
  }
  for (const config of policy.requiredConfigFiles) {
    if (!(config in files)) problems.push(`missing configuration/environment file ${config}`);
  }
  for (const doc of policy.requiredDocumentation) {
    if (!files[doc]?.trim()) problems.push(`missing project documentation ${doc}`);
  }
  if (!files["appforge.structure.json"]?.trim()) {
    problems.push("missing appforge.structure.json");
  }

  problems.push(...conflictingEntrypointProblems(files, adapter.id));
  problems.push(...brokenRelativeImports(files));
  problems.push(...dependencyProblems(files, adapter.id));
  problems.push(...scriptProblems(files, adapter.id));
  problems.push(...lockfileProblems(files, adapter.id));

  return [...new Set(problems)];
}
