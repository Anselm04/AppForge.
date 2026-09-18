import { verifyGeneratedAppInBrowser } from "./browserVerification.js";
import { deployProject } from "./deployer.js";
import { runPostDeploySmokeTest } from "./deployHealth.js";

function productionDockerfile(files: Record<string, string>): string {
  let hasStart = false;
  try {
    const pkg = JSON.parse(files["package.json"] || "{}") as {
      scripts?: Record<string, string>;
    };
    hasStart = typeof pkg.scripts?.start === "string" && pkg.scripts.start.length > 0;
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

  return `FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi\nCOPY . .\nRUN if node -e "const p=require('./package.json');process.exit(p.scripts&&p.scripts.test?0:1)"; then npm test; fi\nRUN npm run build\nENV NODE_ENV=production\nENV PORT=3000\nEXPOSE 3000\n${command}\n`;
}

export function prepareProductionFiles(
  files: Record<string, string>,
): Record<string, string> {
  const prepared = { ...files };
  // Production certification owns the build recipe so generated/customer
  // Dockerfiles cannot bypass the mandatory isolated test + build gates.
  prepared["Dockerfile"] = productionDockerfile(prepared);
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
}): Promise<{ liveUrl: string }> {
  if (!process.env.FLY_API_TOKEN) {
    throw new Error(
      "Validated build cannot complete production flow because FLY_API_TOKEN is not configured",
    );
  }

  const files = prepareProductionFiles(opts.files);
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

  return { liveUrl };
}
