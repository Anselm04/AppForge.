import { STACK_ADAPTERS } from "./stackAdapters.js";

export type StackDetection =
  { ok: true; stack: string; reason: string } | { ok: false; reason: string };

function parseJson(raw: string | undefined): Record<string, unknown> | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function packageDeps(pkg: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
    const value = pkg[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const name of Object.keys(value)) names.add(name);
    }
  }
  return names;
}

const AI_NODE_PACKAGES = [
  "openai",
  "@anthropic-ai/sdk",
  "langchain",
  "@langchain/core",
  "ai",
  "@google/generative-ai",
];
const NODE_SERVER_PACKAGES = [
  "express",
  "fastify",
  "koa",
  "hono",
  "@hapi/hapi",
];
const CHART_PACKAGES = [
  "recharts",
  "chart.js",
  "react-chartjs-2",
  "d3",
  "@nivo/core",
  "echarts",
];
const AI_PYTHON =
  /(^|["'\s])(openai|anthropic|langchain|langgraph|crewai|autogen|pyautogen|llama[-_]index)\b/im;

/**
 * Detect which supported stack adapter an existing repository uses, from its
 * manifests and entry files. Returns ok:false when the repository does not
 * match a supported adapter — callers must not substitute a default stack.
 */
export function detectStackFromFiles(
  files: Record<string, string>,
): StackDetection {
  const has = (path: string) => typeof files[path] === "string";

  if (has("pubspec.yaml")) {
    return { ok: true, stack: "flutter-firebase", reason: "pubspec.yaml" };
  }
  if (has("src-tauri/tauri.conf.json") || has("src-tauri/Cargo.toml")) {
    return { ok: true, stack: "tauri-rust", reason: "src-tauri/" };
  }
  const manifest = parseJson(files["manifest.json"]);
  if (manifest && manifest.manifest_version === 3) {
    return {
      ok: true,
      stack: "chrome-extension",
      reason: "manifest.json (MV3)",
    };
  }

  const pkg = parseJson(files["package.json"]);
  if (pkg) {
    const deps = packageDeps(pkg);
    const any = (names: string[]) => names.some((name) => deps.has(name));
    if (deps.has("expo") || deps.has("react-native")) {
      return {
        ok: true,
        stack: "react-native-expo",
        reason: "expo/react-native dependency",
      };
    }
    if (deps.has("electron")) {
      return {
        ok: true,
        stack: "electron-react",
        reason: "electron dependency",
      };
    }
    if (deps.has("next")) {
      return { ok: true, stack: "next-node", reason: "next dependency" };
    }
    if (deps.has("phaser")) {
      return { ok: true, stack: "phaser-html5", reason: "phaser dependency" };
    }
    if (deps.has("three") && !deps.has("react")) {
      return { ok: true, stack: "three-js-3d", reason: "three dependency" };
    }
    if (any(["playwright", "playwright-core", "puppeteer", "puppeteer-core"])) {
      return {
        ok: true,
        stack: "browser-automation",
        reason: "playwright/puppeteer dependency",
      };
    }
    if (deps.has("react")) {
      if (any(CHART_PACKAGES)) {
        return {
          ok: true,
          stack: "data-visualization",
          reason: "react + charting dependency",
        };
      }
      return { ok: true, stack: "react-node", reason: "react dependency" };
    }
    if (any(AI_NODE_PACKAGES)) {
      return { ok: true, stack: "ai-agent-node", reason: "LLM SDK dependency" };
    }
    if (any(NODE_SERVER_PACKAGES)) {
      return {
        ok: true,
        stack: "api-service",
        reason: "Node HTTP framework dependency",
      };
    }
    const scripts = pkg.scripts as Record<string, unknown> | undefined;
    if (typeof pkg.main === "string" || typeof scripts?.start === "string") {
      return {
        ok: true,
        stack: "node-service",
        reason: "Node package with an entrypoint",
      };
    }
    if (has("index.html")) {
      return {
        ok: true,
        stack: "static-html",
        reason: "index.html with tooling-only package.json",
      };
    }
    return {
      ok: false,
      reason: "package.json does not match a supported stack adapter",
    };
  }

  const pythonManifest = files["requirements.txt"] ?? files["pyproject.toml"];
  if (typeof pythonManifest === "string") {
    if (AI_PYTHON.test(pythonManifest)) {
      return {
        ok: true,
        stack: "ai-agent-python",
        reason: "Python LLM dependency",
      };
    }
    return {
      ok: true,
      stack: "python-service",
      reason: "Python dependency manifest",
    };
  }

  if (has("index.html")) {
    return {
      ok: true,
      stack: "static-html",
      reason: "index.html without a build manifest",
    };
  }

  return {
    ok: false,
    reason: `No supported stack detected. Supported stacks: ${STACK_ADAPTERS.map((a) => a.id).join(", ")}`,
  };
}
