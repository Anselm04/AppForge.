import { validateWithExistingHost } from "./existingHostBuildRunner.js";
import { runnerSourceSha256 } from "../lib/runnerSourceDigest.js";
import {
  isolatedRuntimeConfig,
  assertRuntimeProviderAllowed,
} from "./isolatedRuntimeConfig.js";

export type IsolatedBuildResult = {
  passed: boolean;
  stage: string;
  errors: string[];
  durationMs: number;
  isolationId: string;
  nativeEvidence?: {
    runnerArtifactSha256: string;
    flutterAnalyzePassed: boolean;
    flutterTestPassed: boolean;
    androidBuildPassed: boolean;
    iosSimulatorBuildPassed: boolean;
    backendIntegrationPassed: boolean;
  };
};

type RemoteStepProof = {
  passed?: boolean;
  command?: string;
  exitCode?: number;
  outputSha256?: string;
};

type RemoteProof = {
  passed?: boolean;
  stage?: string;
  errors?: unknown;
  durationMs?: number;
  isolationId?: string;
  artifactSha256?: string;
  techStack?: string;
  steps?: Record<string, RemoteStepProof>;
};

const REQUIRED_STEPS = [
  "install",
  "security",
  "tests",
  "build",
  "runtime",
] as const;

const NATIVE_FLUTTER_STEPS = [
  "flutter_analyze",
  "flutter_test",
  "android_build",
  "ios_simulator_build",
] as const;

export function requiredStepsForStack(stack: string): string[] {
  if (!stack.startsWith("flutter-")) return [...REQUIRED_STEPS];
  return [
    ...REQUIRED_STEPS,
    ...NATIVE_FLUTTER_STEPS,
    ...(stack === "flutter-node" ? ["backend_integration"] : []),
  ];
}

export function isolatedBuildConfigured(): boolean {
  return Boolean(isolatedRuntimeConfig("build"));
}

function validateProof(
  value: unknown,
  expectedArtifactSha256: string,
  expectedTechStack: string,
  requiredSteps: readonly string[],
): RemoteProof {
  if (!value || typeof value !== "object") {
    throw new Error("Isolated build runner returned no validation proof");
  }
  const envelope = value as { data?: unknown; result?: unknown };
  const proof = (envelope.data ?? envelope.result ?? value) as RemoteProof;
  if (!proof.isolationId?.trim()) {
    throw new Error("Isolated build runner returned no isolation ID");
  }
  if (!proof.steps || typeof proof.steps !== "object") {
    throw new Error("Isolated build runner returned no step evidence");
  }
  const missing = requiredSteps.filter(
    (step) => proof.steps?.[step]?.passed !== true,
  );
  if (proof.passed === true && missing.length > 0) {
    throw new Error(
      `Isolated build runner claimed success without passing: ${missing.join(", ")}`,
    );
  }
  // For native builds the isolated runner must provide tool invocation
  // results and binary digests; a bare boolean is not compilation proof.
  if (proof.passed === true && expectedTechStack.startsWith("flutter-")) {
    for (const step of NATIVE_FLUTTER_STEPS) {
      const item = proof.steps[step];
      if (
        item?.passed !== true ||
        item.exitCode !== 0 ||
        !item.command?.trim()
      ) {
        throw new Error(`Native Flutter proof incomplete for ${step}`);
      }
    }
    for (const step of ["android_build", "ios_simulator_build"]) {
      if (!/^[a-f0-9]{64}$/i.test(proof.steps[step]?.outputSha256 ?? "")) {
        throw new Error(`Native Flutter binary digest missing for ${step}`);
      }
    }
    if (expectedTechStack === "flutter-node") {
      const backend = proof.steps.backend_integration;
      if (
        backend?.passed !== true ||
        backend.exitCode !== 0 ||
        !backend.command?.trim()
      ) {
        throw new Error("Native Flutter backend integration proof is missing");
      }
    }
  }
  if (
    proof.passed === true &&
    (proof.artifactSha256 !== expectedArtifactSha256 ||
      proof.techStack !== expectedTechStack)
  ) {
    throw new Error(
      "Isolated build runner proof does not match the generated artifact or selected stack",
    );
  }
  return proof;
}

export async function validateWithIsolatedBuildRunner(
  files: Record<string, string>,
  techStack: string,
): Promise<IsolatedBuildResult | null> {
  const config = isolatedRuntimeConfig("build");
  if (!config) return validateWithExistingHost(files, techStack);
  const endpoint = new URL(config.url);
  assertRuntimeProviderAllowed(endpoint);
  if (endpoint.username || endpoint.password) {
    throw new Error("Isolated build URL must not contain credentials");
  }
  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new Error("Isolated production build URL must use HTTPS");
  }

  const serializedFiles = JSON.stringify(files);
  if (Buffer.byteLength(serializedFiles, "utf8") > 5_000_000) {
    throw new Error("Generated project exceeds isolated build payload limit");
  }
  const requiredSteps = requiredStepsForStack(techStack);
  const artifactSha256 = runnerSourceSha256(files);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60_000);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
        "x-appforge-agent-runtime": config.provider,
        "x-appforge-artifact-sha256": artifactSha256,
      },
      body: JSON.stringify({
        operation: "validate-generated-product",
        techStack,
        artifactSha256,
        files,
        requiredSteps,
        policy: {
          cleanWorkspace: true,
          disposable: true,
          noHostCredentials: true,
          testsBlocking: true,
          dependencyAudit: true,
          secretScan: true,
          blockNetworkToPrivateRanges: true,
          blockShellExecution: true,
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Isolated build runner failed with HTTP ${response.status}`,
      );
    }
    const proof = validateProof(
      await response.json(),
      artifactSha256,
      techStack,
      requiredSteps,
    );
    const stage =
      proof.passed === true
        ? "isolated_runtime"
        : proof.stage?.trim() || "isolated_runtime";
    return {
      passed: proof.passed === true,
      stage,
      errors: Array.isArray(proof.errors)
        ? proof.errors.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      durationMs: proof.durationMs ?? Date.now() - startedAt,
      isolationId: proof.isolationId!,
      ...(techStack.startsWith("flutter-") && proof.passed === true
        ? {
            nativeEvidence: {
              runnerArtifactSha256: artifactSha256,
              flutterAnalyzePassed: true,
              flutterTestPassed: true,
              androidBuildPassed: true,
              iosSimulatorBuildPassed: true,
              backendIntegrationPassed:
                techStack !== "flutter-node" ||
                proof.steps?.backend_integration?.passed === true,
            },
          }
        : {}),
    };
  } finally {
    clearTimeout(timeout);
  }
}
