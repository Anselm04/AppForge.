import JSZip from "jszip";

interface VercelDeployResponse {
  id: string;
  url: string;
  state?: string;
  readyState?: string;
}

const VERCEL_POLL_INTERVAL = 5000; // 5 seconds
const VERCEL_POLL_MAX = 24; // 24 attempts = 2 minutes max

/** Deploy generated files to Vercel and poll until ready */
export async function deployToVercel(
  projectName: string,
  files: Record<string, string>
): Promise<string> {
  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken) {
    throw new Error("VERCEL_TOKEN not configured");
  }

  const teamId = process.env.VERCEL_TEAM_ID;
  const createUrl = teamId
    ? `https://api.vercel.com/v13/deployments?teamId=${teamId}`
    : "https://api.vercel.com/v13/deployments";

  const sanitized = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30);

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
      files: fileMap,
      target: "production",
      framework: null,
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

  // Poll deployment status until READY or ERROR
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

    if (state === "READY") {
      return previewUrl;
    }
    if (state === "ERROR" || state === "CANCELED") {
      throw new Error(`Vercel deployment failed with state: ${state}`);
    }
  }

  // Timed out waiting for ready — still return URL (Vercel may finish building)
  return previewUrl;
}

/** Create a ZIP archive from generated files and return as base64 */
export async function zipFiles(
  projectName: string,
  files: Record<string, string>
): Promise<{ base64: string; filename: string }> {
  const zip = new JSZip();

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const base64 = buffer.toString("base64");
  const filename = `${projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 30)}-appforge.zip`;

  return { base64, filename };
}

export default { deployToVercel, zipFiles };