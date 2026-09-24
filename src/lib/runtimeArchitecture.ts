import { getStackAdapter, type StackAdapter } from "./stackAdapters.js";

export type RuntimeSupport = "native" | "conditional" | "unsupported";

export type RuntimeArchitecture = {
  version: 1;
  stack: string;
  runtime: StackAdapter["runtime"];
  startup: {
    command: string | null;
    entrypoints: string[];
    hostManaged: boolean;
  };
  shutdown: {
    mode: "signals" | "platform_lifecycle" | "host_managed";
    signals: string[];
    graceful: boolean;
  };
  health: {
    mode: "http" | "document" | "native_runtime";
    livenessPath: string | null;
    readinessPath: string | null;
  };
  environment: {
    files: string[];
    secretsServerSide: boolean;
    failClosedWhenMissing: boolean;
  };
  port: {
    mode: "environment" | "platform" | "none";
    environmentVariable: string | null;
    defaultPort: number | null;
  };
  assets: {
    mode: "static_output" | "framework" | "service" | "native_bundle" | "extension_bundle";
    roots: string[];
    outputDirectory: string | null;
  };
  persistence: {
    mode: "external_service" | "client_local" | "native_platform" | "none";
    isolateFromAppForge: true;
  };
  backgroundWorkers: RuntimeSupport;
  scheduledTasks: RuntimeSupport;
  streaming: RuntimeSupport;
  webSockets: RuntimeSupport;
  fileUploads: RuntimeSupport;
  externalServices: RuntimeSupport;
};

function serviceRuntime(adapter: StackAdapter): boolean {
  return adapter.previewMode === "service";
}

function browserRuntime(adapter: StackAdapter): boolean {
  return adapter.runtime === "browser";
}

function assetRoots(adapter: StackAdapter): string[] {
  if (adapter.runtime === "mobile") return ["assets/"];
  if (adapter.runtime === "extension") return ["icons/", "assets/"];
  if (adapter.runtime === "desktop") return ["assets/", "src/assets/"];
  if (adapter.id === "next-node") return ["public/", "app/"];
  if (browserRuntime(adapter) || adapter.artifactKind === "web")
    return ["public/", "assets/", "src/assets/"];
  return ["assets/"];
}

export function getRuntimeArchitecture(stackId: string): RuntimeArchitecture {
  const adapter = getStackAdapter(stackId);
  const service = serviceRuntime(adapter);
  const browser = browserRuntime(adapter);
  const nativeLifecycle =
    adapter.runtime === "mobile" ||
    adapter.runtime === "desktop" ||
    adapter.runtime === "extension";
  const frameworkServer = adapter.previewMode === "next";
  const serverCapable = serverCapable;

  const persistence: RuntimeArchitecture["persistence"]["mode"] =
    serverCapable
      ? "external_service"
      : browser
        ? "client_local"
        : nativeLifecycle
          ? "native_platform"
          : "none";

  const healthMode: RuntimeArchitecture["health"]["mode"] = serverCapable
    ? "http"
    : browser
      ? "document"
      : "native_runtime";

  const assetsMode: RuntimeArchitecture["assets"]["mode"] =
    adapter.runtime === "extension"
      ? "extension_bundle"
      : adapter.runtime === "mobile" || adapter.runtime === "desktop"
        ? "native_bundle"
        : service && adapter.artifactKind === "service"
          ? "service"
          : adapter.previewMode === "vite" || adapter.previewMode === "static"
            ? "static_output"
            : "framework";

  const webCapability: RuntimeSupport =
    serverCapable ? "conditional" : "unsupported";

  return {
    version: 1,
    stack: adapter.id,
    runtime: adapter.runtime,
    startup: {
      command: adapter.startCommand,
      entrypoints: adapter.entrypoints,
      hostManaged: adapter.startCommand === null,
    },
    shutdown: {
      mode: service
        ? "signals"
        : nativeLifecycle
          ? "platform_lifecycle"
          : "host_managed",
      signals: service ? ["SIGTERM", "SIGINT"] : [],
      graceful: service || nativeLifecycle,
    },
    health: {
      mode: healthMode,
      livenessPath: service
        ? "/health/live"
        : frameworkServer
          ? "/api/health/live"
          : null,
      readinessPath: service
        ? "/health/ready"
        : frameworkServer
          ? "/api/health/ready"
          : null,
    },
    environment: {
      files: adapter.environmentFiles,
      secretsServerSide: serverCapable,
      failClosedWhenMissing: true,
    },
    port: {
      mode: serverCapable
        ? "environment"
        : nativeLifecycle
          ? "platform"
          : "none",
      environmentVariable:
        serverCapable
          ? "PORT"
          : null,
      defaultPort:
        adapter.runtime === "python"
          ? 8000
          : serverCapable
            ? 3000
            : null,
    },
    assets: {
      mode: assetsMode,
      roots: assetRoots(adapter),
      outputDirectory: adapter.outputDirectory,
    },
    persistence: {
      mode: persistence,
      isolateFromAppForge: true,
    },
    backgroundWorkers: serverCapable ? "conditional" : "unsupported",
    scheduledTasks:
      adapter.artifactKind === "automation" || serverCapable
        ? "conditional"
        : "unsupported",
    streaming: webCapability,
    webSockets: webCapability,
    fileUploads:
      serverCapable
        ? "conditional"
        : nativeLifecycle
          ? "conditional"
          : "unsupported",
    externalServices:
      serverCapable
        ? "conditional"
        : nativeLifecycle
          ? "conditional"
          : "unsupported",
  };
}

export function runtimeArchitectureInstruction(stackId: string): string {
  const runtime = getRuntimeArchitecture(stackId);
  return [
    "[APPFORGE STACK RUNTIME CONTRACT — AUTHORITATIVE]",
    JSON.stringify(runtime, null, 2),
    "Do not apply runtime assumptions from another stack.",
    "Implement only capabilities marked native/conditional when required by the product contract.",
    "For conditional capabilities, generate explicit configuration, validation, error handling, and lifecycle behavior.",
    "[END APPFORGE STACK RUNTIME CONTRACT]",
  ].join("\n");
}
