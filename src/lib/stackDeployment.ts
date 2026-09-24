import { getRuntimeArchitecture } from "./runtimeArchitecture.js";
import { getStackAdapter, type StackAdapter } from "./stackAdapters.js";

/** Build identity every production deployment must serve (artifact sha). */
export const BUILD_IDENTITY_PATH = "/.well-known/appforge-build.json";
export const BUILD_IDENTITY_FILE = "public/.well-known/appforge-build.json";
export const PRODUCTION_INTERNAL_PORT = 3000;

/** Playwright's image must match the playwright package version exactly. */
export const PLAYWRIGHT_VERSION = "1.59.1";

export type ProductionVerification = "browser" | "http_health";

export type StackProductionPlan = {
  stack: string;
  destination: "fly";
  internalPort: number;
  dockerfile: string;
  /** browser: render the root in Chromium. http_health: probe health paths. */
  verification: ProductionVerification;
  healthPaths: string[];
  identityPath: string;
  identityFile: string;
};

const INSTALL =
  "RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi";

function packageScripts(files: Record<string, string>): Record<string, string> {
  try {
    const pkg = JSON.parse(files["package.json"] || "{}") as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

/**
 * Static output (Vite builds, static sites): build with Node, serve the
 * output directory with nginx on the internal port, SPA fallback, and the
 * build identity copied into the served root.
 */
function staticOutputDockerfile(outputDirectory: string): string {
  const out = outputDirectory.replace(/\/+$/, "");
  return [
    "FROM node:22-alpine AS build",
    "WORKDIR /app",
    "COPY package*.json ./",
    INSTALL,
    "COPY . .",
    "RUN npm run build",
    `RUN mkdir -p ${out}/.well-known && if [ -d public/.well-known ]; then cp -R public/.well-known/. ${out}/.well-known/; fi`,
    "FROM nginx:1.27-alpine",
    `RUN printf 'server {\\n  listen ${PRODUCTION_INTERNAL_PORT};\\n  root /usr/share/nginx/html;\\n  location / {\\n    try_files $uri $uri/ /index.html;\\n  }\\n}\\n' > /etc/nginx/conf.d/default.conf`,
    `COPY --from=build /app/${out} /usr/share/nginx/html`,
    `EXPOSE ${PRODUCTION_INTERNAL_PORT}`,
    'CMD ["nginx", "-g", "daemon off;"]',
    "",
  ].join("\n");
}

function nodeServerDockerfile(start: string, base = "node:22-alpine"): string {
  return [
    `FROM ${base}`,
    "WORKDIR /app",
    "COPY package*.json ./",
    INSTALL,
    "COPY . .",
    "RUN npm run build",
    "ENV NODE_ENV=production",
    `ENV PORT=${PRODUCTION_INTERNAL_PORT}`,
    `EXPOSE ${PRODUCTION_INTERNAL_PORT}`,
    start,
    "",
  ].join("\n");
}

function isViteOrStaticOutput(adapter: StackAdapter): boolean {
  return adapter.previewMode === "vite" || adapter.previewMode === "static";
}

/**
 * React + Vite apps are static output unless the generated project ships its
 * own server (a start script that is not `vite preview`).
 */
function reactAppHasOwnServer(files: Record<string, string>): boolean {
  const start = packageScripts(files).start;
  return (
    typeof start === "string" &&
    start.trim() !== "" &&
    !/\bvite\s+preview\b/.test(start)
  );
}

/**
 * Stack-specific production packaging. Throws for structural-only stacks and
 * for stacks that do not list Fly as a deployment target.
 */
export function productionPlanForStack(
  stackId: string,
  files: Record<string, string>,
): StackProductionPlan {
  const adapter = getStackAdapter(stackId);
  if (adapter.generationMode === "structural") {
    throw new Error(
      `Structural-only stack ${adapter.id} has no production deployment; export the source instead`,
    );
  }
  if (!adapter.deploymentTargets.includes("fly")) {
    throw new Error(
      `Stack ${adapter.id} does not support production deployment to fly`,
    );
  }
  const runtime = getRuntimeArchitecture(adapter.id);
  const healthPaths = [
    runtime.health.livenessPath,
    runtime.health.readinessPath,
  ].filter((path): path is string => typeof path === "string");
  const base = {
    stack: adapter.id,
    destination: "fly" as const,
    internalPort: PRODUCTION_INTERNAL_PORT,
    identityPath: BUILD_IDENTITY_PATH,
    identityFile: BUILD_IDENTITY_FILE,
  };

  if (adapter.id === "next-node") {
    return {
      ...base,
      dockerfile: nodeServerDockerfile(
        `CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "${PRODUCTION_INTERNAL_PORT}"]`,
      ),
      verification: "browser",
      healthPaths,
    };
  }

  if (adapter.previewMode === "service") {
    const baseImage =
      adapter.id === "browser-automation"
        ? `mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble`
        : "node:22-alpine";
    return {
      ...base,
      dockerfile: nodeServerDockerfile(
        'CMD ["npm", "run", "start"]',
        baseImage,
      ),
      verification: "http_health",
      healthPaths,
    };
  }

  if (isViteOrStaticOutput(adapter)) {
    if (adapter.id === "react-node" && reactAppHasOwnServer(files)) {
      return {
        ...base,
        dockerfile: nodeServerDockerfile('CMD ["npm", "run", "start"]'),
        verification: "browser",
        healthPaths,
      };
    }
    return {
      ...base,
      dockerfile: staticOutputDockerfile(adapter.outputDirectory ?? "dist"),
      verification: "browser",
      healthPaths,
    };
  }

  throw new Error(`No production packaging is defined for stack ${adapter.id}`);
}

export type BuildDeploymentDecision =
  | { action: "deploy" }
  | { action: "skip"; deployment: "structural_source_only" | "not_production" };

/**
 * What the build worker does after a validated build. Structural-only stacks
 * complete as source deliverables and are never deployed or given a live URL.
 */
export function buildDeploymentDecision(
  techStack: string,
  nodeEnv: string | undefined,
): BuildDeploymentDecision {
  const adapter = getStackAdapter(techStack);
  if (adapter.generationMode === "structural") {
    return { action: "skip", deployment: "structural_source_only" };
  }
  if (nodeEnv !== "production") {
    return { action: "skip", deployment: "not_production" };
  }
  return { action: "deploy" };
}
