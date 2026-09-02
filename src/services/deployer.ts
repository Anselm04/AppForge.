import { createHmac } from "crypto";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";
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
  "vercel" | "netlify" | "fly" | "github-pages" | "zip" | "preview";

export type DeployDestinationStatus = Record<
  DeployDestination,
  { configured: boolean; label: string }
>;

function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env?: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ exitCode: 1, stdout, stderr: stderr + "\n[TIMEOUT]" });
    }, timeoutMs);
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

function detectVercelFramework(files: Record<string, string>): string | null {
  if (
    files["next.config.mjs"] ||
    files["next.config.js"] ||
    files["app/page.tsx"]
  ) {
    return "nextjs";
  }
  if (files["astro.config.mjs"] || files["astro.config.ts"]) return "astro";
  if (files["remix.config.js"] || files["app/root.tsx"]) return "remix";
  if (files["svelte.config.js"]) return "sveltekit";
  if (
    files["vite.config.ts"] ||
    files["vite.config.js"] ||
    files["index.html"]
  ) {
    return "vite";
  }
  if (files["api/hello.ts"] || files["vercel.json"]) return null;
  return "vite";
}

/** Signed live-preview URL token (HMAC of projectId). */
export function previewSignature(projectId: number): string {
  const secret =
    process.env.PREVIEW_SECRET ||
    process.env.COOKIE_SECRET ||
    process.env.JWT_SECRET ||
    "appforge-preview-dev";
  return createHmac("sha256", secret)
    .update(`preview:${projectId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyPreviewSignature(
  projectId: number,
  sig: string | undefined,
): boolean {
  if (!sig) return false;
  const expected = previewSignature(projectId);
  if (sig.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < sig.length; i++)
    ok |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return ok === 0;
}

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

  const framework = detectVercelFramework(files);
  const fileEntries = Object.entries(files).map(([file, data]) => ({
    file,
    data,
  }));

  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: sanitized,
      files: fileEntries,
      projectSettings: {
        framework,
        buildCommand: files["package.json"] ? "npm run build" : undefined,
        outputDirectory:
          framework === "vite" || framework === "astro" ? "dist" : undefined,
      },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(
      `Vercel deploy creation failed: ${createRes.status} ${text}`,
    );
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
        name: projectName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .slice(0, 30),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!createSite.ok) {
      throw new Error(`Netlify site create failed: ${await createSite.text()}`);
    }
    const site = (await createSite.json()) as {
      id: string;
      ssl_url?: string;
      url?: string;
    };
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

async function ensureFlyApp(appName: string, token: string): Promise<void> {
  const org = process.env.FLY_ORG || "personal";
  const res = await fetch("https://api.machines.dev/v1/apps", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app_name: appName, org_slug: org }),
    signal: AbortSignal.timeout(30000),
  });
  // 422 = already exists — fine
  if (!res.ok && res.status !== 422 && res.status !== 409) {
    const text = await res.text();
    // GET to confirm existence
    const getRes = await fetch(`https://api.machines.dev/v1/apps/${appName}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!getRes.ok) {
      throw new Error(`Fly app create failed: ${res.status} ${text}`);
    }
  }
}

async function flyctlAvailable(): Promise<boolean> {
  const r = await runCmd("flyctl", ["version"], process.cwd(), 10000);
  if (r.exitCode === 0) return true;
  const r2 = await runCmd("fly", ["version"], process.cwd(), 10000);
  return r2.exitCode === 0;
}

async function deployToFly(
  projectName: string,
  files: Record<string, string>,
): Promise<{ url: string; note?: string }> {
  const token = process.env.FLY_API_TOKEN;
  const appName =
    process.env.FLY_APP_NAME ||
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 30);

  if (!files["Dockerfile"]) {
    files["Dockerfile"] = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build || true
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "start"]
`;
  }
  if (!files["fly.toml"]) {
    files["fly.toml"] = `app = "${appName}"
primary_region = "iad"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
`;
  }
  if (!files[".dockerignore"]) {
    files[".dockerignore"] = "node_modules\n.git\ndist\n.env\n";
  }

  if (!token) {
    throw new Error(
      "FLY_API_TOKEN not configured. Download the ZIP and run: fly launch && fly deploy",
    );
  }

  await ensureFlyApp(appName, token);

  const hasFlyctl = await flyctlAvailable();
  if (hasFlyctl) {
    const tmpDir = join(tmpdir(), `appforge-fly-${Date.now()}`);
    try {
      await mkdir(tmpDir, { recursive: true });
      for (const [path, content] of Object.entries(files)) {
        const full = join(tmpDir, path);
        await mkdir(join(full, ".."), { recursive: true });
        await writeFile(full, content, "utf-8");
      }
      const bin =
        (await runCmd("flyctl", ["version"], process.cwd(), 5000)).exitCode ===
        0
          ? "flyctl"
          : "fly";
      const deploy = await runCmd(
        bin,
        ["deploy", "--remote-only", "--app", appName, "--yes"],
        tmpDir,
        300_000,
        { FLY_API_TOKEN: token },
      );
      if (deploy.exitCode !== 0) {
        throw new Error(
          `fly deploy failed: ${(deploy.stderr || deploy.stdout).slice(0, 500)}`,
        );
      }
      return { url: `https://${appName}.fly.dev` };
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  return {
    url: `https://${appName}.fly.dev`,
    note: `Fly app "${appName}" is ready. Install flyctl in the build host for fully automated image deploys, or download the ZIP and run: fly deploy --app ${appName}`,
  };
}

async function deployToGitHubPages(
  projectName: string,
  files: Record<string, string>,
): Promise<{ url: string; note?: string }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN not configured. Connect GitHub OAuth or set GITHUB_TOKEN, then retry.",
    );
  }

  const owner =
    process.env.GITHUB_PAGES_OWNER || process.env.GITHUB_OWNER || "";
  if (!owner) {
    throw new Error(
      "Set GITHUB_PAGES_OWNER (or GITHUB_OWNER) to enable one-click GitHub Pages deploy.",
    );
  }

  const repoName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 50);

  // Ensure repo exists
  const createRes = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "AppForge",
    },
    body: JSON.stringify({
      name: repoName,
      private: false,
      auto_init: false,
      description: "Deployed by AppForge",
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!createRes.ok && createRes.status !== 422) {
    throw new Error(`GitHub repo create failed: ${await createRes.text()}`);
  }

  // Upload via git trees API (single commit)
  const blobs: { path: string; mode: "100644"; type: "blob"; sha: string }[] =
    [];
  for (const [path, content] of Object.entries(files)) {
    const blobRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "AppForge",
        },
        body: JSON.stringify({ content, encoding: "utf-8" }),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!blobRes.ok) {
      throw new Error(
        `GitHub blob failed for ${path}: ${await blobRes.text()}`,
      );
    }
    const blob = (await blobRes.json()) as { sha: string };
    blobs.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "AppForge",
      },
      body: JSON.stringify({ tree: blobs }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!treeRes.ok)
    throw new Error(`GitHub tree failed: ${await treeRes.text()}`);
  const tree = (await treeRes.json()) as { sha: string };

  const commitRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "AppForge",
      },
      body: JSON.stringify({
        message: "Deploy from AppForge",
        tree: tree.sha,
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!commitRes.ok)
    throw new Error(`GitHub commit failed: ${await commitRes.text()}`);
  const commit = (await commitRes.json()) as { sha: string };

  // Create or update gh-pages branch
  const refRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/gh-pages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "AppForge",
      },
      body: JSON.stringify({ ref: "refs/heads/gh-pages", sha: commit.sha }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!refRes.ok) {
    await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/gh-pages`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "AppForge",
        },
        body: JSON.stringify({ sha: commit.sha, force: true }),
        signal: AbortSignal.timeout(30000),
      },
    );
  }

  // Enable Pages
  await fetch(`https://api.github.com/repos/${owner}/${repoName}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "AppForge",
    },
    body: JSON.stringify({
      source: { branch: "gh-pages", path: "/" },
    }),
    signal: AbortSignal.timeout(30000),
  }).catch(() => {});

  return {
    url: `https://${owner}.github.io/${repoName}/`,
    note: "GitHub Pages may take a minute to become active.",
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
      configured: !!(
        process.env.GITHUB_TOKEN &&
        (process.env.GITHUB_PAGES_OWNER || process.env.GITHUB_OWNER)
      ),
      label: "GitHub Pages",
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
    case "github-pages": {
      const result = await deployToGitHubPages(projectName, files);
      return { url: result.url, destination, note: result.note };
    }
    case "zip":
      return {
        url: "zip://download",
        destination,
        note: "Use the Download ZIP button / projects.download endpoint.",
      };
    case "preview": {
      if (!projectId) throw new Error("projectId required for preview deploy");
      const base = (
        previewBaseUrl ||
        process.env.CORS_ORIGIN ||
        process.env.APP_URL ||
        "https://appforge-unfurling-moon-9058.fly.dev"
      ).replace(/\/$/, "");
      return { url: `${base}/apps/${projectId}`, destination };
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
  previewSignature,
  verifyPreviewSignature,
};
