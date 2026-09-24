import { createHash } from "node:crypto";

export type IsolatedBuildResult = {
  passed: boolean;
  stage: string;
  errors: string[];
  durationMs: number;
  isolationId: string;
};

type RemoteProof = {
  passed?: boolean;
  stage?: string;
  errors?: unknown;
  durationMs?: number;
  isolationId?: string;
  steps?: Record<string, { passed?: boolean }>;
};

const REQUIRED_STEPS = ["install", "security", "tests", "build", "runtime"] as const;

export function isolatedBuildConfigured(): boolean {
  return Boolean(
    (process.env.SPRITES_BUILD_URL || process.env.SPRITES_EXEC_URL)?.trim() &&
    process.env.SPRITES_API_TOKEN?.trim(),
  );
}

function validateProof(value: unknown): RemoteProof {
  if (!value || typeof value !== "object") {
    throw new Error("Sprites build runner returned no validation proof");
  }
  const envelope = value as { data?: unknown; result?: unknown };
  const proof = (envelope.data ?? envelope.result ?? value) as RemoteProof;
  if (!proof.isolationId?.trim()) {
    throw new Error("Sprites build runner returned no isolation ID");
  }
  if (!proof.steps || typeof proof.steps !== "object") {
    throw new Error("Sprites build runner returned no step evidence");
  }
  const missing = REQUIRED_STEPS.filter(
    (step) => proof.steps?.[step]?.passed !== true,
  );
  if (proof.passed === true && missing.length > 0) {
    throw new Error(
      `Sprites build runner claimed success without passing: ${missing.join(", ")}`,
    );
  }
  return proof;
}

export async function validateWithIsolatedBuildRunner(
  files: Record<string, string>,
  techStack: string,
): Promise<IsolatedBuildResult | null> {
  if (!isolatedBuildConfigured()) return null;

  const endpoint = new URL(
    (process.env.SPRITES_BUILD_URL || process.env.SPRITES_EXEC_URL)!.trim(),
  );
  if (endpoint.username || endpoint.password) {
    throw new Error("Sprites build URL must not contain credentials");
  }
  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new Error("Sprites production build URL must use HTTPS");
  }

  const serializedFiles = JSON.stringify(files);
  if (Buffer.byteLength(serializedFiles, "utf8") > 5_000_000) {
    throw new Error("Generated project exceeds isolated build payload limit");
  }
  const artifactSha256 = createHash("sha256")
    .update(serializedFiles)
    .digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60_000);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: `Bearer ${process.env.SPRITES_API_TOKEN!.trim()}`,
        "content-type": "application/json",
        "x-appforge-agent-runtime": "sprites",
        "x-appforge-artifact-sha256": artifactSha256,
      },
      body: JSON.stringify({
        operation: "validate-generated-product",
        techStack,
        artifactSha256,
        files,
        requiredSteps: REQUIRED_STEPS,
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
        `Sprites build runner failed with HTTP ${response.status}`,
      );
    }
    const proof = validateProof(await response.json());
    return {
      passed: proof.passed === true,
      stage: proof.stage?.trim() || "isolated_runtime",
      errors: Array.isArray(proof.errors)
        ? proof.errors.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      durationMs: proof.durationMs ?? Date.now() - startedAt,
      isolationId: proof.isolationId!,
    };
  } finally {
    clearTimeout(timeout);
  }
}
