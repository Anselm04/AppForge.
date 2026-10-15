import { describe, it, expect } from "vitest";
import { getStackAdapter } from "../stackAdapters.js";
import { detectStackFromFiles } from "../stackDetection.js";
import { getRuntimeArchitecture } from "../runtimeArchitecture.js";
import { getGeneratedProjectStructurePolicy } from "../generatedProjectStructure.js";
import { STACK_EXTERNAL_DEPENDENCIES } from "../stackDependencies.js";
import { STACK_RESEARCH_TARGETS } from "../researchTargets.js";
describe("explicit Flutter and Node composite architecture", () => {
  it("keeps both entrypoints structural and detects the combined artifact", () => {
    const adapter = getStackAdapter("Flutter + Node");
    expect(adapter.id).toBe("flutter-node");
    expect(adapter.generationMode).toBe("structural");
    expect(adapter.entrypoints).toEqual([
      "lib/main.dart",
      "server/src/server.ts",
    ]);
    expect(
      detectStackFromFiles({
        "pubspec.yaml": "name: app",
        "package.json": "{}",
        "server/src/server.ts": "server",
      }),
    ).toMatchObject({ ok: true, stack: "flutter-node" });
    expect(detectStackFromFiles({ "pubspec.yaml": "name: app" })).toMatchObject(
      { stack: "flutter-firebase" },
    );
  });
  it("keeps mobile health separate from backend and external persistence", () => {
    const runtime = getRuntimeArchitecture("flutter-node");
    expect(runtime.health.mode).toBe("native_runtime");
    expect(runtime.health.livenessPath).toBeNull();
    expect(runtime.backend).toMatchObject({
      runtime: "node",
      health: { livenessPath: "/health/live", readinessPath: "/health/ready" },
      secretsOwner: "backend",
      persistence: "external_service",
    });
    expect(runtime.environment.secretsServerSide).toBe(true);
    expect(runtime.backgroundWorkers).toBe("conditional");
    const policy = getGeneratedProjectStructurePolicy("flutter-node");
    expect(policy.routingBoundary).toBe("lib/");
    expect(policy.apiBoundary).toBe("server/src/");
    expect(policy.databaseBoundary).toBe("server/src/db/");
    expect(
      STACK_EXTERNAL_DEPENDENCIES["flutter-node"].map((d) => d.adapterId),
    ).toEqual(
      expect.arrayContaining([
        "node-runtime",
        "flutter-sdk",
        "android-sdk-gradle",
        "xcode-apple-toolchain",
      ]),
    );
    expect(STACK_RESEARCH_TARGETS["flutter-node"].repositories).toContain(
      "flutter/flutter",
    );
  });
});

import { validateRuntimeImplementation } from "../runtimeArchitecture.js";
import { getStackScaffold } from "../../services/stackScaffolds.js";
describe("composite backend structural runtime validation", () => {
  it("accepts the shared-contract scaffold without claiming native runtime proof", () => {
    expect(
      validateRuntimeImplementation(
        getStackScaffold("flutter-node", "mobile_app"),
        "flutter-node",
      ),
    ).toEqual([]);
  });
  it("does not let Flutter source satisfy missing backend runtime contracts", () => {
    const files = getStackScaffold("flutter-node", "mobile_app");
    files["server/src/server.ts"] = "export const server = true;";
    files["server/src/api-contract.ts"] = "export const contract = {};";
    files["lib/main.dart"] +=
      "\n// process.env.PORT SIGTERM SIGINT .close() /health/live /health/ready";
    const problems = validateRuntimeImplementation(files, "flutter-node");
    expect(problems).toContain("backend runtime must read port from PORT");
    expect(problems).toContain(
      "missing backend graceful shutdown handler for SIGTERM",
    );
    expect(problems).toContain("missing backend HTTP health handling");
  });
});
