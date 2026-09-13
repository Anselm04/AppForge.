import { createHmac } from "crypto";
import { mkdir, writeFile, rm } from "fs/promises";
import { dirname, resolve, sep } from "path";
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

function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env?: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd, shell: false, env: env ?? process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolvePromise({ exitCode: 1, stdout, stderr: stderr + "\n[TIMEOUT]" });
    }, timeoutMs);
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

function detectVercelFramework(files: Record<string, string>): string | null {
  if (files["next.config.mjs"] || files["next.config.js"] || files["app/page.tsx"])
    return "nextjs";
  if (files["astro.config.mjs"] || files["astro.config.ts"]) return "astro";
  if (files["remix.config.js"] || files["app/root.tsx"]) return "remix";
  if (files["svelte.config.js"]) return "sveltekit";
  if (files["vite.config.ts"] || files["vite.config.js"] || files["index.html"])
    return "vite";
  if (files["api/hello.ts"] || files["vercel.json"]) return null;
  return "vite";
}

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
  for (let i = 0; i < sig.length; i++) {
    ok |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return ok === 0;
}

export async function deployToVercel(
  projectName: string,
  files: Record<string, string>,
): Promise<string> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not configured");
  const teamId = process.env.VERCEL_TEAM_ID;
  const createUrl = teamId
    ? `https://api.vercel.com/v13/deployments?teamId=${teamId}`
    : "https://api.vercel.com/v13/deployments";
  const name = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 30);
  const res = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      files: Object.entries(files).map(([file, data]) => ({ file, data })),
      projectSettings: {
        framework: detectVercelFramework(files),
        buildCommand: files["package.json"] ? "npm run build" : undefined,
      },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    throw new Error(
      `Vercel deploy creation failed: ${res.status} ${await res.text()}`,
    );
  }
  const d = (await res.json()) as VercelDeployResponse;
  for (let i = 0; i < VERCEL_POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, VERCEL_POLL_INTERVAL));
    const u = teamId
      ? `https://api.vercel.com/v13/deployments/${d.id}?teamId=${teamId}`
      : `https://api.vercel.com/v13/deployments/${d.id}`;
    const s = await fetch(u, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!s.ok) continue;
    const st = (await s.json()) as VercelDeployResponse;
    const state = st.readyState ?? st.state;
    if (state === "READY") return `https://${d.url}`;
    if (state === "ERROR" || state === "CANCELED") {
      throw new Error(`Vercel deployment failed with state: ${state}`);
    }
  }
  throw new Error("Vercel deployment did not become ready before timeout");
}

async function deployToNetlify(
  projectName: string,
  files: Record<string, string>,
): Promise<string> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) throw new Error("NETLIFY_AUTH_TOKEN not configured");
  let siteId = process.env.NETLIFY_SITE_ID;
  if (!siteId) {
    const r = await fetch("https://api.netlify.com/api/v1/sites", {
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
    if (!r.ok) {
      throw new Error(`Netlify site create failed: ${await r.text()}`);
    }
    siteId = ((await r.json()) as { id: string }).id;
  }
  const zip = await zipFiles(projectName, files);
  const r = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip",
    },
    body: Buffer.from(zip.base64, "base64"),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error(`Netlify deploy failed: ${await r.text()}`);
  const d = (await r.json()) as {
    ssl_url?: string;
    deploy_ssl_url?: string;
    url?: string;
  };
  return (
    d.ssl_url ||
    d.deploy_ssl_url ||
    d.url ||
    `https://app.netlify.com/sites/${siteId}`
  );
}

function customerFlyAppName(projectName: string, projectId?: number): string {
  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20) || "app";
  const identity = `${projectId ?? "project"}:${projectName}`;
  const suffix = createHmac(
    "sha256",
    process.env.COOKIE_SECRET || process.env.JWT_SECRET || "appforge-dev",
  )
    .update(identity)
    .digest("hex")
    .slice(0, 8);
  return `af-${slug}-${suffix}`;
}

async function ensureFlyApp(appName: string, token: string): Promise<void> {
  const org = process.env.FLY_ORG || "personal";
  const r = await fetch("https://api.machines.dev/v1/apps", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app_name: appName, org_slug: org }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok && r.status !== 422 && r.status !== 409) {
    const g = await fetch(`https://api.machines.dev/v1/apps/${appName}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!g.ok) {
      throw new Error(`Fly app create failed: ${r.status} ${await r.text()}`);
    }
  }
}

async function flyctlBinary(): Promise<"flyctl" | "fly" | null> {
  if ((await runCmd("flyctl", ["version"], process.cwd(), 10000)).exitCode === 0) {
    return "flyctl";
  }
  if ((await runCmd("fly", ["version"], process.cwd(), 10000)).exitCode === 0) {
    return "fly";
  }
  return null;
}

function safeGeneratedPath(root: string, filePath: string): string {
  const normalizedRoot = resolve(root);
  const full = resolve(normalizedRoot, filePath);
  if (full !== normalizedRoot && !full.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(`Unsafe generated file path rejected: ${filePath}`);
  }
  return full;
}

async function deployToFly(
  projectName: string,
  files: Record<string, string>,
  projectId?: number,
): Promise<{ url: string; note?: string }> {
  const token = process.env.FLY_API_TOKEN;
  if (!token) throw new Error("FLY_API_TOKEN not configured");
  const bin = await flyctlBinary();
  if (!bin) {
    throw new Error(
      "Fly deployment is unavailable because flyctl is not installed on the AppForge runtime",
    );
  }

  const appName = customerFlyAppName(projectName, projectId);
  const protectedNames = new Set(
    [
      process.env.FLY_APP_NAME,
      process.env.APPFORGE_FLY_APP_NAME,
      "appforge",
      "appforge-production",
    ].filter(Boolean),
  );
  if (protectedNames.has(appName)) {
    throw new Error(
      "Refusing to deploy customer project over the AppForge production application",
    );
  }

  if (!files["Dockerfile"]) {
    files["Dockerfile"] = `FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi\nCOPY . .\nRUN npm run build\nENV NODE_ENV=production\nENV PORT=3000\nEXPOSE 3000\nCMD ["npm", "run", "start"]\n`;
  }
  if (!files["fly.toml"]) {
    files["fly.toml"] = `app = "${appName}"\nprimary_region = "syd"\n\n[build]\n\n[http_service]\n  internal_port = 3000\n  force_https = true\n  auto_stop_machines = true\n  auto_start_machines = true\n  min_machines_running = 0\n`;
  }
  if (!files[".dockerignore"]) {
    files[".dockerignore"] = "node_modules\n.git\ndist\n.env\n.env.*\n";
  }

  await ensureFlyApp(appName, token);
  const dir = resolve(tmpdir(), `appforge-fly-${projectId ?? "project"}-${Date.now()}`);
  try {
    await mkdir(dir, { recursive: true });
    for (const [filePath, content] of Object.entries(files)) {
      const full = safeGeneratedPath(dir, filePath);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, content, "utf-8");
    }

    const safeEnv = {
      PATH: process.env.PATH || "",
      HOME: process.env.HOME || "/tmp",
      FLY_API_TOKEN: token,
    };
    const d = await runCmd(
      bin,
      ["deploy", "--remote-only", "--app", appName, "--yes"],
      dir,
      300000,
      safeEnv,
    );
    if (d.exitCode !== 0) {
      throw new Error(
        `fly deploy failed: ${(d.stderr || d.stdout).slice(0, 500)}`,
      );
    }
    return { url: `https://${appName}.fly.dev` };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
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
  const owner = process.env.GITHUB_PAGES_OWNER || process.env.GITHUB_OWNER || "";
  if (!owner) {
    throw new Error(
      "Set GITHUB_PAGES_OWNER (or GITHUB_OWNER) to enable one-click GitHub Pages deploy.",
    );
  }
  throw new Error(
    `GitHub Pages deployment for ${projectName} must use the authenticated GitHub project export workflow (${Object.keys(files).length} files).`,
  );
}

export async function zipFiles(
  projectName: string,
  files: Record<string, string>,
): Promise<{ base64: string; filename: string }> {
  const zip = new JSZip();
  for (const [p, c] of Object.entries(files)) zip.file(p, c);
  const b = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return {
    base64: b.toString("base64"),
    filename: `${projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30)}-appforge.zip`,
  };
}

export function listDeployDestinations(): DeployDestinationStatus {
  return {
    vercel: { configured: !!process.env.VERCEL_TOKEN, label: "Vercel" },
    netlify: {
      configured: !!process.env.NETLIFY_AUTH_TOKEN,
      label: "Netlify",
    },
    fly: { configured: !!process.env.FLY_API_TOKEN, label: "Fly.io" },
    "github-pages": {
      configured: false,
      label: "GitHub Pages",
    },
    zip: { configured: true, label: "ZIP download" },
    preview: { configured: true, label: "AppForge live preview" },
  };
}
export const getDeployDestinationStatus = listDeployDestinations;

export async function deployProject(opts: {
  destination: DeployDestination;
  projectName: string;
  files: Record<string, string>;
  projectId?: number;
  previewBaseUrl?: string;
}): Promise<{ url: string; destination: DeployDestination; note?: string }> {
  const { destination, projectName, files, projectId, previewBaseUrl } = opts;
  switch (destination) {
    case "vercel":
      return { url: await deployToVercel(projectName, files), destination };
    case "netlify":
      return { url: await deployToNetlify(projectName, files), destination };
    case "fly": {
      const r = await deployToFly(projectName, { ...files }, projectId);
      return { url: r.url, destination, note: r.note };
    }
    case "github-pages": {
      const r = await deployToGitHubPages(projectName, files);
      return { url: r.url, destination, note: r.note };
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