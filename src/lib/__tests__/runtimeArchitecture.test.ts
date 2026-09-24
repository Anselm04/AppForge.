import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STACK_ADAPTERS } from "../stackAdapters.js";
import {
  getRuntimeArchitecture,
  runtimeArchitectureInstruction,
} from "../runtimeArchitecture.js";
import { getStackScaffold } from "../../services/stackScaffolds.js";

describe("#15 runtime architecture", () => {
  it("defines a complete runtime policy for every supported stack", () => {
    for (const adapter of STACK_ADAPTERS) {
      const runtime = getRuntimeArchitecture(adapter.id);
      expect(runtime.stack, adapter.id).toBe(adapter.id);
      expect(runtime.runtime, adapter.id).toBe(adapter.runtime);
      expect(runtime.startup.entrypoints, adapter.id).toEqual(adapter.entrypoints);
      expect(runtime.startup.command, adapter.id).toBe(adapter.startCommand);
      expect(runtime.environment.files, adapter.id).toEqual(adapter.environmentFiles);
      expect(runtime.assets.outputDirectory, adapter.id).toBe(adapter.outputDirectory);
      expect(runtime.persistence.isolateFromAppForge, adapter.id).toBe(true);
    }
  });

  it("uses service lifecycle assumptions only for service runtimes", () => {
    for (const stack of ["api-service", "node-service", "ai-agent-node", "browser-automation", "python-service", "ai-agent-python"]) {
      const runtime = getRuntimeArchitecture(stack);
      expect(runtime.shutdown.mode, stack).toBe("signals");
      expect(runtime.shutdown.signals, stack).toEqual(["SIGTERM", "SIGINT"]);
      expect(runtime.health.mode, stack).toBe("http");
      expect(runtime.health.livenessPath, stack).toBe("/health/live");
      expect(runtime.health.readinessPath, stack).toBe("/health/ready");
      expect(runtime.port.mode, stack).toBe("environment");
      expect(runtime.port.environmentVariable, stack).toBe("PORT");
    }

    for (const stack of ["static-html", "phaser-html5", "three-js-3d", "data-visualization"]) {
      const runtime = getRuntimeArchitecture(stack);
      expect(runtime.shutdown.mode, stack).toBe("host_managed");
      expect(runtime.health.mode, stack).toBe("document");
      expect(runtime.port.mode, stack).toBe("none");
      expect(runtime.webSockets, stack).toBe("unsupported");
    }
  });

  it("uses native platform lifecycle for mobile, desktop and extensions", () => {
    for (const stack of ["react-native-expo", "flutter-firebase", "electron-react", "tauri-rust", "chrome-extension"]) {
      const runtime = getRuntimeArchitecture(stack);
      expect(runtime.shutdown.mode, stack).toBe("platform_lifecycle");
      expect(runtime.health.mode, stack).toBe("native_runtime");
      expect(runtime.port.mode, stack).toBe("platform");
    }
  });

  it("persists the exact runtime contract with each stack scaffold", () => {
    for (const adapter of STACK_ADAPTERS) {
      const scaffold = getStackScaffold(adapter.id, adapter.productTypes[0]);
      expect(JSON.parse(scaffold["appforge.runtime.json"]), adapter.id).toEqual(
        getRuntimeArchitecture(adapter.id),
      );
    }
  });

  it("gives service scaffolds liveness, readiness and graceful shutdown behavior", () => {
    const node = getStackScaffold("api-service", "api")["src/server.ts"];
    expect(node).toContain('/health/live');
    expect(node).toContain('/health/ready');
    expect(node).toContain('SIGTERM');
    expect(node).toContain('SIGINT');
    expect(node).toContain('server.close');

    const python = getStackScaffold("python-service", "api")["app/main.py"];
    expect(python).toContain('/health/live');
    expect(python).toContain('/health/ready');
    expect(python).toContain('lifespan');
  });

  it("injects the authoritative runtime contract into planner and coder stages", () => {
    const part0 = readFileSync("src/agents/.pipeline_parts/part0.txt", "utf8");
    const part1 = readFileSync("src/agents/.pipeline_parts/part1.txt", "utf8");
    const part2 = readFileSync("src/agents/.pipeline_parts/part2.txt", "utf8");
    expect(part0).toContain("runtimeArchitectureInstruction");
    expect(part1).toContain("const runtimeContract = runtimeArchitectureInstruction(techStack)");
    expect(part1).toContain("runtimeContract");
    expect(part2.match(/\$\{runtimeContract\}/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("explicitly tells agents not to borrow runtime assumptions across stacks", () => {
    const instruction = runtimeArchitectureInstruction("api-service");
    expect(instruction).toContain("Do not apply runtime assumptions from another stack");
    expect(instruction).toContain('"livenessPath": "/health/live"');
    expect(instruction).toContain('"environmentVariable": "PORT"');
  });
});
