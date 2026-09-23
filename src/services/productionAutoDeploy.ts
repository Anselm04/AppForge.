import { createHash } from "node:crypto";
import { verifyGeneratedAppInBrowser } from "./browserVerification.js";
import { deployProject } from "./deployer.js";
import { probeDeployUrl, runPostDeploySmokeTest } from "./deployHealth.js";
import {
  validateProductContract,
  type ProductContract,
} from "../lib/productContract.js";

export type ProductionCertification = {
  liveUrl: string;
  artifactSha256: string;
  httpVerified: true;
  assetsVerified: number;
  browserVerified: true;
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

function productionDockerfile(files: Record<string, string>): string {
  let hasStart = false;
  try {
    const pkg = JSON.parse(files["package.json"] || "{}") as {
      scripts?: Record<string, string>;
    };
    hasStart =
      typeof pkg.scripts?.start === "string" && pkg.scripts.start.length > 0;
  } catch {
    hasStart = false;
  }

  const isVite =
    !!files["vite.config.ts"] ||
    !!files["vite.config.js"] ||
    !!files["index.html"];

  const command = hasStart
    ? 'CMD ["npm", "run", "start"]'
    : isVite
      ? 'CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]'
      : 'CMD ["npm", "run", "start"]';

  return `FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi\nCOPY . .\nRUN npm run build\nENV NODE_ENV=production\nENV PORT=3000\nEXPOSE 3000\n${command}\n`;
}

export function prepareProductionFiles(
  files: Record<string, string>,
): Record<string, string> {
  const prepared = { ...files };
  const artifactSha256 = generatedArtifactSha256(files);
  prepared["public/.well-known/appforge-build.json"] = JSON.stringify({
    artifactSha256,
  });
  if (!prepared["Dockerfile"]) {
    prepared["Dockerfile"] = productionDockerfile(prepared);
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
}): Promise<ProductionCertification> {
  const contract = validateProductContract(opts.productContract);
  if (
    contract.deploymentRequirements.length === 0 ||
    contract.runtimeRequirements.length === 0
  ) {
    throw new Error("Canonical product contract is missing deployment/runtime requirements");
  }
  if (!process.env.FLY_API_TOKEN) {
    throw new Error(
      "Validated build cannot complete production flow because FLY_API_TOKEN is not configured",
    );
  }

  const files = prepareProductionFiles(opts.files);
  const artifactSha256 = generatedArtifactSha256(opts.files);
  const deployed = await deployProject({
    destination: "fly",
    projectName: opts.projectName,
    files,
    projectId: opts.projectId,
  });

  if (!deployed.url) {
    throw new Error("Fly production deployment did not return a live URL");
  }

  const liveUrl = requireVerifiedLiveUrl(deployed.url);
  const identity = await probeDeployUrl(
    new URL("/.well-known/appforge-build.json", liveUrl).toString(),
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
    artifactSha256,
    httpVerified: true,
    assetsVerified: smoke.assets.length,
    browserVerified: true,
  };
}
