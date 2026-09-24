import { createHash } from "node:crypto";
import { verifyGeneratedAppInBrowser } from "./browserVerification.js";
import { deployProject } from "./deployer.js";
import { probeDeployUrl, runPostDeploySmokeTest } from "./deployHealth.js";
import {
  validateProductContract,
  type ProductContract,
} from "../lib/productContract.js";
import { getStackAdapter } from "../lib/stackAdapters.js";
import {
  productionPlanForStack,
  type ProductionVerification,
} from "../lib/stackDeployment.js";
import {
  assertArtifactIntegrity,
  type ArtifactIntegrity,
} from "../lib/artifactIntegrity.js";
import {
  scanProjectFiles,
  validateGeneratedSecurityPosture,
} from "./projectSecurityScanner.js";

export type ProductionCertification = {
  liveUrl: string;
  snapshotId?: number;
  artifactVersion?: number;
  persistedArtifactSha256?: string;
  artifactSha256: string;
  httpVerified: true;
  assetsVerified: number;
  /** true for UI stacks (Chromium render); false for HTTP services. */
  browserVerified: boolean;
  verification: ProductionVerification;
  healthPathsVerified: string[];
};

export function generatedArtifactSha256(files: Record<string, string>): string {
  const canonical = Object.keys(files)
    .filter(
      (path) =>
        path !== "Dockerfile" &&
        path !== "public/.well-known/appforge-build.json",
    )
    .sort()
    .map((path) => `${path}\0${files[path]}\0`)
    .join("");
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Package a validated artifact for production with the stack adapter's own
 * Dockerfile (static output via nginx, Next.js server, Node service, or the
 * Playwright image for browser automation) and the build identity file.
 * Structural-only stacks have no production packaging and throw.
 */
export function prepareProductionFiles(
  files: Record<string, string>,
  techStack: string,
): Record<string, string> {
  const plan = productionPlanForStack(techStack, files);
  const prepared = { ...files };
  const artifactSha256 = generatedArtifactSha256(files);
  prepared[plan.identityFile] = JSON.stringify({
    artifactSha256,
  });
  if (!prepared["Dockerfile"]) {
    prepared["Dockerfile"] = plan.dockerfile;
  }
  return prepared;
}

export function requireVerifiedLiveUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Fly production deployment returned an invalid live URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Fly production deployment must return an HTTPS live URL");
  }
  return parsed.toString();
}

export async function deployValidatedProject(opts: {
  projectId: number;
  projectName: string;
  files: Record<string, string>;
  productContract: ProductContract;
  snapshot?: {
    id: number;
    version: number;
    integrity: ArtifactIntegrity;
  };
}): Promise<ProductionCertification> {
  const contract = validateProductContract(opts.productContract);
  if (opts.snapshot) {
    assertArtifactIntegrity({
      files: opts.files,
      integrity: opts.snapshot.integrity,
      projectId: opts.projectId,
      artifactVersion: opts.snapshot.version,
      requiredState: "final",
    });
  }
  const stackAdapter = getStackAdapter(contract.selectedTechnologyStack);
  const securityScan = scanProjectFiles(opts.files);
  const securityPosture = validateGeneratedSecurityPosture(
    opts.files,
    stackAdapter.id,
    contract,
  );
  const blockingSecurityFindings = [
    ...securityScan.findings.filter(
      (finding) =>
        finding.severity === "critical" || finding.severity === "high",
    ),
    ...securityPosture,
  ];
  if (blockingSecurityFindings.length > 0) {
    throw new Error(
      "Production deployment blocked by generated-project security findings: " +
        blockingSecurityFindings
          .slice(0, 10)
          .map(
            (finding) => `${finding.ruleId} at ${finding.path}:${finding.line}`,
          )
          .join(", "),
    );
  }

  if (stackAdapter.generationMode === "structural") {
    throw new Error(
      `Structural-only stack ${stackAdapter.id} cannot be production-certified until its native runtime is verified`,
    );
  }
  if (
    contract.deploymentRequirements.length === 0 ||
    contract.runtimeRequirements.length === 0
  ) {
    throw new Error(
      "Canonical product contract is missing deployment/runtime requirements",
    );
  }
  if (!process.env.FLY_API_TOKEN) {
    throw new Error(
      "Validated build cannot complete production flow because FLY_API_TOKEN is not configured",
    );
  }

  const plan = productionPlanForStack(stackAdapter.id, opts.files);
  const files = prepareProductionFiles(opts.files, stackAdapter.id);
  const artifactSha256 = generatedArtifactSha256(opts.files);
  const deployed = await deployProject({
    destination: "fly",
    projectName: opts.projectName,
    files,
    projectId: opts.projectId,
    techStack: stackAdapter.id,
    productContract: contract,
  });

  if (!deployed.url) {
    throw new Error("Fly production deployment did not return a live URL");
  }

  const liveUrl = requireVerifiedLiveUrl(deployed.url);
  const identity = await probeDeployUrl(
    new URL(plan.identityPath, liveUrl).toString(),
    15_000,
    true,
  );
  let deployedIdentity: { artifactSha256?: string } = {};
  try {
    deployedIdentity = JSON.parse(identity.body || "{}") as {
      artifactSha256?: string;
    };
  } catch {
    // handled by the exact identity check below
  }
  if (!identity.ok || deployedIdentity.artifactSha256 !== artifactSha256) {
    throw new Error(
      `Production deployment artifact identity verification failed at ${liveUrl}`,
    );
  }
  if (plan.verification === "http_health") {
    // HTTP services have no UI to render; they are certified by their
    // runtime-contract liveness/readiness endpoints instead.
    if (plan.healthPaths.length === 0) {
      throw new Error(
        `Stack ${stackAdapter.id} has no health endpoints to verify`,
      );
    }
    for (const healthPath of plan.healthPaths) {
      const health = await probeDeployUrl(
        new URL(healthPath, liveUrl).toString(),
        15_000,
      );
      if (!health.ok) {
        throw new Error(
          `Production deployment failed service health verification at ${healthPath} (HTTP ${health.statusCode ?? "unreachable"}) at ${liveUrl}`,
        );
      }
    }
    return {
      liveUrl,
      snapshotId: opts.snapshot?.id,
      artifactVersion: opts.snapshot?.version,
      persistedArtifactSha256: opts.snapshot?.integrity.sha256,
      artifactSha256,
      httpVerified: true,
      assetsVerified: 0,
      browserVerified: false,
      verification: plan.verification,
      healthPathsVerified: plan.healthPaths,
    };
  }

  const smoke = await runPostDeploySmokeTest(liveUrl);
  if (!smoke.ok) {
    throw new Error(
      `Production deployment failed live HTTP verification (HTTP ${smoke.root.statusCode ?? "unreachable"}) at ${liveUrl}`,
    );
  }

  const browser = await verifyGeneratedAppInBrowser(liveUrl);
  if (!browser.ok) {
    const runtimeDetail = browser.runtimeErrors[0]
      ? `; ${browser.runtimeErrors[0].slice(0, 240)}`
      : "";
    throw new Error(
      `Production deployment failed real browser verification at ${liveUrl}: ${browser.error ?? "render failed"}${runtimeDetail}`,
    );
  }

  return {
    liveUrl,
    snapshotId: opts.snapshot?.id,
    artifactVersion: opts.snapshot?.version,
    persistedArtifactSha256: opts.snapshot?.integrity.sha256,
    artifactSha256,
    httpVerified: true,
    assetsVerified: smoke.assets.length,
    browserVerified: true,
    verification: plan.verification,
    healthPathsVerified: [],
  };
}
