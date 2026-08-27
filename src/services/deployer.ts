import JSZip from "jszip";

interface VercelDeployResponse {
  id: string;
  url: string;
  state?: string;
  readyState?: string;
}

const VERCEL_POLL_INTERVAL = 5000;
const VERCEL_POLL_MAX = 24;

export type DeployDestination =
  | "vercel"
  | "netlify"
  | "fly"
  | "github-pages"
  | "zip"
  | "preview";

export type DeployDestinationStatus = Record<
  DeployDestination,
  { configured: boolean; label: string }
>;

/** Deploy generated files to Vercel and poll until ready */
export async function deployToVercel(
  projectName: string,
  files: Record<string, string>,
): Promise<string> {
  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken) {
    throw new Error("VERCEL_TOKEN not configured");
  }

  const teamId = process.env.VERCEL_TEAM_ID;
  const createUrl = teamId
    ? `https://api.vercel.com/v13/deployments?teamId=${teamId}`
    : "https://api.vercel.com/v13/deployments";

  const sanitized = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 30);

  const fileMap: Record<string, { content: string }> = {};
  for (const [path, content] of Object.entries(files)) {
    fileMap[path] = { content };
  }

  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: sanitized,
      files: Object.entries(fileMap).map(([file, data]) => ({
        file,
        data: data.content,
      })),
      projectSettings: { framework: null },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Vercel deploy creation failed: ${createRes.status} ${text}`);
  }

  const deploy = (await createRes.json()) as VercelDeployResponse;
  const deployId = deploy.id;
  const previewUrl = `https://${deploy.url}`;

  for (let i = 0; i < VERCEL_POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, VERCEL_POLL_INTERVAL));

    const statusUrl = teamId
      ? `https://api.vercel.com/v13/deployments/${deployId}?teamId=${teamId}`
      : `https://api.vercel.com/v13/deployments/${deployId}`;

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${vercelToken}` },
      signal: AbortSignal.timeout(30000),
    });

    if (!statusRes.ok) continue;

    const status = (await statusRes.json()) as VercelDeployResponse;
    const state = status.readyState ?? status.state;

    if (state === "READY") return previewUrl;
    if (state === "ERROR" || state === "CANCELED") {
      throw new Error(`Vercel deployment failed with state: ${state}`);
    }
  }

  return previewUrl;
}

async function deployToNetlify(
  projectName: string,
  files: Record<string, string>,
): Promise<string> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) throw new Error("NETLIFY_AUTH_TOKEN not configured");

  let siteId = process.env.NETLIFY_SITE_ID;
  if (!siteId) {
    const createSite = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!createSite.ok) {
      throw new Error(`Netlify site create failed: ${await createSite.text()}`);
    }
    const site = (await createSite.json()) as { id: string; ssl_url?: string; url?: string };
    siteId = site.id;
  }

  const zip = await zipFiles(projectName, files);
  const binary = Buffer.from(zip.base64, "base64");
  const deployRes = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/zip",
      },
      body: binary,
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!deployRes.ok) {
    throw new Error(`Netlify deploy failed: ${await deployRes.text()}`);
  }
  const deployed = (await deployRes.json()) as {
    ssl_url?: string;
    deploy_ssl_url?: string;
    url?: string;
  };
  return (
    deployed.ssl_url ||
    deployed.deploy_ssl_url ||
    deployed.url ||
    `https://app.netlify.com/sites/${siteId}`
  );
}

async function deployToFly(
  projectName: string,
  files: Record<string, string>,
): Promise<{ url: string; note?: string }> {
  const token = process.env.FLY_API_TOKEN;
  const appName =
    process.env.FLY_APP_NAME ||
    projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30);

  // Ensure Dockerfile exists for Fly builds
  if (!files["Dockerfile"]) {
    files["Dockerfile"] = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build || true
EXPOSE 3000
CMD ["npm", "run", "start"]
`;
  }
  if (!files["fly.toml"]) {
    files["fly.toml"] = `app = "${appName}"
primary_region = "iad"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
`;
  }

  if (!token) {
    throw new Error(
      "FLY_API_TOKEN not configured. Download the ZIP and run: fly launch && fly deploy",
    );
  }

  return {
    url: `https://${appName}.fly.dev`,
    note: "Fly token detected. Push the ZIP via flyctl deploy, or wire Machines API for fully automated deploys.",
  };
}

/** Create a ZIP archive from generated files and return as base64 */
export async function zipFiles(
  projectName: string,
  files: Record<string, string>,
): Promise<{ base64: string; filename: string }> {
  const zip = new JSZip();

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const base64 = buffer.toString("base64");
  const filename = `${projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 30)}-appforge.zip`;

  return { base64, filename };
}

export function listDeployDestinations(): DeployDestinationStatus {
  return {
    vercel: {
      configured: !!process.env.VERCEL_TOKEN,
      label: "Vercel",
    },
    netlify: {
      configured: !!process.env.NETLIFY_AUTH_TOKEN,
      label: "Netlify",
    },
    fly: {
      configured: !!process.env.FLY_API_TOKEN,
      label: "Fly.io",
    },
    "github-pages": {
      configured: !!process.env.GITHUB_TOKEN || !!process.env.GITHUB_CLIENT_ID,
      label: "GitHub Pages / repo",
    },
    zip: { configured: true, label: "ZIP download" },
    preview: { configured: true, label: "AppForge live preview" },
  };
}

export async function deployProject(opts: {
  destination: DeployDestination;
  projectName: string;
  files: Record<string, string>;
  projectId?: number;
  previewBaseUrl?: string;
}): Promise<{ url: string; destination: DeployDestination; note?: string }> {
  const { destination, projectName, files, projectId, previewBaseUrl } = opts;

  switch (destination) {
    case "vercel": {
      const url = await deployToVercel(projectName, files);
      return { url, destination };
    }
    case "netlify": {
      const url = await deployToNetlify(projectName, files);
      return { url, destination };
    }
    case "fly": {
      const result = await deployToFly(projectName, { ...files });
      return { url: result.url, destination, note: result.note };
    }
    case "github-pages":
      return {
        url: "",
        destination,
        note: "Use Export to GitHub, then enable GitHub Pages on the repo.",
      };
    case "zip":
      return {
        url: "zip://download",
        destination,
        note: "Use the Download ZIP button / projects.download endpoint.",
      };
    case "preview": {
      if (!projectId) throw new Error("projectId required for preview deploy");
      const base = (previewBaseUrl || process.env.APP_URL || "").replace(/\/$/, "");
      if (!base) throw new Error("APP_URL / previewBaseUrl required for preview");
      return { url: `${base}/live/${projectId}`, destination };
    }
    default:
      throw new Error(`Unknown destination: ${destination as string}`);
  }
}

export default {
  deployToVercel,
  zipFiles,
  deployProject,
  listDeployDestinations,
};
