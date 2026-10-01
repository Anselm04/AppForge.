import { createHash } from "node:crypto";
import { getRuntimeArchitecture } from "./runtimeArchitecture.js";
import { getStackAdapter } from "./stackAdapters.js";
import {
  validateProductContract,
  type ProductContract,
} from "./productContract.js";
import { BUILD_IDENTITY_PATH } from "./stackDeployment.js";

export const TRUSTED_PRODUCTION_DESTINATIONS = [
  "vercel",
  "netlify",
  "fly",
] as const;

export type TrustedProductionDestination =
  (typeof TRUSTED_PRODUCTION_DESTINATIONS)[number];

export type ProductionDeploymentManifest = {
  version: 2;
  stack: string;
  destination: TrustedProductionDestination;
  build: {
    command: string | null;
    outputDirectory: string | null;
    generationMode: string;
  };
  environment: {
    requiredFiles: string[];
    requiredVariables: string[];
    failClosedWhenMissing: true;
    secretsServerSide: boolean;
  };
  startup: {
    command: string | null;
    entrypoints: string[];
    hostManaged: boolean;
  };
  health: {
    mode: string;
    livenessPath: string | null;
    readinessPath: string | null;
    timeoutMs: number;
  };
  domain: {
    customDomainSupported: boolean;
    canonicalHostRequired: boolean;
  };
  tls: {
    required: boolean;
    forceHttps: boolean;
  };
  assets: {
    mode: string;
    roots: string[];
    outputDirectory: string | null;
    verifyReferencedAssets: boolean;
  };
  database: {
    required: boolean;
    migrationArtifacts: string[];
    migrateBeforeReadiness: boolean;
    rollbackOrForwardRepairRequired: boolean;
  };
  workers: {
    support: string;
    requested: boolean;
    requireSingleWriterOrIdempotency: boolean;
  };
  scheduledJobs: {
    support: string;
    requested: boolean;
    requireSingleWriterOrIdempotency: boolean;
  };
  scaling: {
    minInstances: number;
    maxInstances: number;
    autoscale: boolean;
  };
  resources: {
    cpuCount: number;
    memoryMb: number;
    requestTimeoutMs: number;
  };
  reliability: {
    deployAttempts: number;
    deployTimeoutMs: number;
    healthTimeoutMs: number;
    rollbackStrategy: "previous_verified_artifact";
    rollbackRequired: true;
  };
  tracking: {
    artifactHashAlgorithm: "sha256";
    artifactSha256: string;
    artifactVersion: number | null;
    identityPath: string;
    auditRequired: true;
  };
};

export type DeploymentAuditRecord = {
  id: string;
  event: "production_deployment_verified";
  destination: TrustedProductionDestination;
  stack: string;
  artifactSha256: string;
  artifactVersion: number | null;
  verifiedAt: string;
  liveUrl: string;
};

function parseJsonFile<T>(
  files: Record<string, string>,
  path: string,
  problems: string[],
): T | null {
  const raw = files[path];
  if (!raw) {
    problems.push(`missing ${path}`);
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    problems.push(`${path} is invalid JSON`);
    return null;
  }
}

function envVariablesFromFiles(
  files: Record<string, string>,
  environmentFiles: string[],
): string[] {
  const keys = new Set<string>();
  for (const path of environmentFiles) {
    const source = files[path];
    if (!source) continue;
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
      if (match?.[1]) keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

function migrationArtifacts(files: Record<string, string>): string[] {
  return Object.keys(files)
    .filter((path) =>
      /(?:^|\/)(?:migrations?|drizzle)(?:\/|$)|\.migration\.|schema\.sql$/i.test(
        path,
      ),
    )
    .sort();
}

function requestedWorkers(contract: ProductContract): boolean {
  const text = [
    contract.originalPrompt,
    contract.canonicalInterpretation,
    ...contract.coreWorkflows,
    ...contract.runtimeRequirements,
  ].join(" ");
  return /\b(worker|background job|queue|job processor|consumer)\b/i.test(text);
}

function requestedScheduledJobs(contract: ProductContract): boolean {
  const text = [
    contract.originalPrompt,
    contract.canonicalInterpretation,
    ...contract.coreWorkflows,
    ...contract.runtimeRequirements,
  ].join(" ");
  return /\b(cron|scheduled job|scheduled task|recurring|hourly|daily|weekly)\b/i.test(
    text,
  );
}

export function validateDeploymentSource(input: {
  files: Record<string, string>;
  productContract: ProductContract;
  destination?: string;
}): string[] {
  const contract = validateProductContract(input.productContract);
  const adapter = getStackAdapter(contract.selectedTechnologyStack);
  const runtime = getRuntimeArchitecture(adapter.id);
  const problems: string[] = [];
  const supportedDeploymentTargets =
    adapter.generationMode === "structural" ? [] : adapter.deploymentTargets;

  if (input.destination && adapter.generationMode === "structural") {
    problems.push(
      `structural-only stack ${adapter.id} is a source deliverable and cannot be production deployed`,
    );
  }

  if (
    contract.deploymentRequirements.length === 0 ||
    contract.runtimeRequirements.length === 0
  ) {
    problems.push(
      "canonical contract is missing deployment/runtime requirements",
    );
  }

  const deployMeta = parseJsonFile<{
    stack?: string;
    targets?: string[];
    buildCommand?: string | null;
    startCommand?: string | null;
    outputDirectory?: string | null;
    generationMode?: string;
  }>(input.files, "appforge.deploy.json", problems);
  const runtimeMeta = parseJsonFile<{
    stack?: string;
    startup?: { command?: string | null; entrypoints?: string[] };
    health?: {
      mode?: string;
      livenessPath?: string | null;
      readinessPath?: string | null;
    };
    environment?: {
      files?: string[];
      secretsServerSide?: boolean;
      failClosedWhenMissing?: boolean;
    };
    assets?: {
      mode?: string;
      roots?: string[];
      outputDirectory?: string | null;
    };
    persistence?: { mode?: string; isolateFromAppForge?: boolean };
    backgroundWorkers?: string;
    scheduledTasks?: string;
  }>(input.files, "appforge.runtime.json", problems);

  if (deployMeta) {
    if (deployMeta.stack !== adapter.id) {
      problems.push("deployment metadata stack does not match canonical stack");
    }
    if (
      JSON.stringify(deployMeta.targets ?? []) !==
      JSON.stringify(supportedDeploymentTargets)
    ) {
      problems.push("deployment targets do not match selected stack adapter");
    }
    if (deployMeta.buildCommand !== adapter.buildCommand) {
      problems.push("deployment build command does not match selected stack");
    }
    if (deployMeta.startCommand !== adapter.startCommand) {
      problems.push("deployment start command does not match selected stack");
    }
    if (deployMeta.outputDirectory !== adapter.outputDirectory) {
      problems.push(
        "deployment output directory does not match selected stack",
      );
    }
    if (deployMeta.generationMode !== adapter.generationMode) {
      problems.push("deployment generation mode does not match selected stack");
    }
  }

  if (runtimeMeta) {
    if (runtimeMeta.stack !== adapter.id) {
      problems.push("runtime metadata stack does not match canonical stack");
    }
    if (runtimeMeta.startup?.command !== runtime.startup.command) {
      problems.push("runtime startup command does not match selected stack");
    }
    if (
      JSON.stringify(runtimeMeta.startup?.entrypoints ?? []) !==
      JSON.stringify(runtime.startup.entrypoints)
    ) {
      problems.push("runtime entrypoints do not match selected stack");
    }
    if (runtimeMeta.health?.mode !== runtime.health.mode) {
      problems.push("runtime health mode does not match selected stack");
    }
    if (runtimeMeta.health?.livenessPath !== runtime.health.livenessPath) {
      problems.push("runtime liveness path does not match selected stack");
    }
    if (runtimeMeta.health?.readinessPath !== runtime.health.readinessPath) {
      problems.push("runtime readiness path does not match selected stack");
    }
    if (
      JSON.stringify(runtimeMeta.environment?.files ?? []) !==
      JSON.stringify(runtime.environment.files)
    ) {
      problems.push("runtime environment files do not match selected stack");
    }
    if (runtimeMeta.environment?.failClosedWhenMissing !== true) {
      problems.push(
        "runtime environment must fail closed when configuration is missing",
      );
    }
    if (runtimeMeta.persistence?.isolateFromAppForge !== true) {
      problems.push("generated persistence must remain isolated from AppForge");
    }
  }

  for (const envFile of adapter.environmentFiles) {
    if (!input.files[envFile]?.trim()) {
      problems.push(`missing required environment/config artifact ${envFile}`);
    }
  }

  if (contract.secondaryCapabilities.includes("database")) {
    if (migrationArtifacts(input.files).length === 0) {
      problems.push(
        "database-backed deployment has no migration/schema artifact",
      );
    }
  }

  if (
    requestedWorkers(contract) &&
    runtime.backgroundWorkers === "unsupported"
  ) {
    problems.push(
      `stack ${adapter.id} does not support requested background workers`,
    );
  }
  if (
    requestedScheduledJobs(contract) &&
    runtime.scheduledTasks === "unsupported"
  ) {
    problems.push(
      `stack ${adapter.id} does not support requested scheduled jobs`,
    );
  }

  if (input.destination) {
    if (
      !TRUSTED_PRODUCTION_DESTINATIONS.includes(
        input.destination as TrustedProductionDestination,
      )
    ) {
      problems.push(`unsupported production destination ${input.destination}`);
    } else if (!supportedDeploymentTargets.includes(input.destination)) {
      problems.push(
        `stack ${adapter.id} does not support deployment destination ${input.destination}`,
      );
    }
  }

  return [...new Set(problems)];
}

export function assertDeploymentSourceReady(input: {
  files: Record<string, string>;
  productContract: ProductContract;
  destination?: string;
}): void {
  const problems = validateDeploymentSource(input);
  if (problems.length > 0) {
    throw new Error(
      `Deployment contract validation failed: ${problems.join("; ")}`,
    );
  }
}

export function createProductionDeploymentManifest(input: {
  files: Record<string, string>;
  productContract: ProductContract;
  destination: TrustedProductionDestination;
  artifactSha256: string;
  artifactVersion?: number;
}): ProductionDeploymentManifest {
  const contract = validateProductContract(input.productContract);
  const adapter = getStackAdapter(contract.selectedTechnologyStack);
  if (adapter.generationMode === "structural") {
    throw new Error(
      `Structural-only stack ${adapter.id} is a source deliverable and cannot receive a production deployment manifest`,
    );
  }
  assertDeploymentSourceReady({
    files: input.files,
    productContract: contract,
    destination: input.destination,
  });

  const runtime = getRuntimeArchitecture(adapter.id);
  const databaseRequired = contract.secondaryCapabilities.includes("database");

  return {
    version: 2,
    stack: adapter.id,
    destination: input.destination,
    build: {
      command: adapter.buildCommand,
      outputDirectory: adapter.outputDirectory,
      generationMode: adapter.generationMode,
    },
    environment: {
      requiredFiles: adapter.environmentFiles,
      requiredVariables: envVariablesFromFiles(
        input.files,
        adapter.environmentFiles,
      ),
      failClosedWhenMissing: true,
      secretsServerSide: runtime.environment.secretsServerSide,
    },
    startup: runtime.startup,
    health: {
      ...runtime.health,
      timeoutMs: 15_000,
    },
    domain: {
      customDomainSupported: true,
      canonicalHostRequired: true,
    },
    tls: {
      required: true,
      forceHttps: true,
    },
    assets: {
      ...runtime.assets,
      verifyReferencedAssets: runtime.assets.mode !== "service",
    },
    database: {
      required: databaseRequired,
      migrationArtifacts: migrationArtifacts(input.files),
      migrateBeforeReadiness: databaseRequired,
      rollbackOrForwardRepairRequired: databaseRequired,
    },
    workers: {
      support: runtime.backgroundWorkers,
      requested: requestedWorkers(contract),
      requireSingleWriterOrIdempotency: true,
    },
    scheduledJobs: {
      support: runtime.scheduledTasks,
      requested: requestedScheduledJobs(contract),
      requireSingleWriterOrIdempotency: true,
    },
    scaling: {
      minInstances: 1,
      maxInstances: 3,
      autoscale: true,
    },
    resources: {
      cpuCount: 1,
      memoryMb: 512,
      requestTimeoutMs: 120_000,
    },
    reliability: {
      deployAttempts: 3,
      deployTimeoutMs: 300_000,
      healthTimeoutMs: 15_000,
      rollbackStrategy: "previous_verified_artifact",
      rollbackRequired: true,
    },
    tracking: {
      artifactHashAlgorithm: "sha256",
      artifactSha256: input.artifactSha256,
      artifactVersion: input.artifactVersion ?? null,
      identityPath: BUILD_IDENTITY_PATH,
      auditRequired: true,
    },
  };
}

export function createDeploymentAuditRecord(input: {
  projectId: number;
  manifest: ProductionDeploymentManifest;
  liveUrl: string;
  verifiedAt?: string;
}): DeploymentAuditRecord {
  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  const id = createHash("sha256")
    .update(
      [
        input.projectId,
        input.manifest.destination,
        input.manifest.tracking.artifactSha256,
        input.manifest.tracking.artifactVersion ?? "unversioned",
        verifiedAt,
      ].join(":"),
    )
    .digest("hex")
    .slice(0, 24);

  return {
    id,
    event: "production_deployment_verified",
    destination: input.manifest.destination,
    stack: input.manifest.stack,
    artifactSha256: input.manifest.tracking.artifactSha256,
    artifactVersion: input.manifest.tracking.artifactVersion,
    verifiedAt,
    liveUrl: input.liveUrl,
  };
}
