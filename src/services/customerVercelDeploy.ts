import { createHash } from "node:crypto";

/**
 * Deploy only to a customer-selected Vercel account/project using an ephemeral
 * credential supplied for this exact deployment. Never fall back to an
 * AppForge platform token and never persist the token in project metadata.
 */
export type CustomerVercelDeployInput = {
  token: string;
  teamId?: string;
  projectName: string;
  files: Record<string, string>;
};

const API = "https://api.vercel.com";
const MAX_FILES = 500;
const MAX_BYTES = 15 * 1024 * 1024;

function safeSourcePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !/^[A-Za-z]:/.test(path) &&
    !/[\x00-\x1f\x7f]/.test(path) &&
    path.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

export async function deployToCustomerVercel(
  input: CustomerVercelDeployInput,
  fetcher: typeof fetch = fetch,
): Promise<{ url: string; deploymentId: string }> {
  if (!input.token.trim()) throw new Error("Customer Vercel credential is required");
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(input.projectName)) {
    throw new Error("Invalid customer Vercel project name");
  }
  if (input.teamId && !/^team_[a-zA-Z0-9]+$/.test(input.teamId)) {
    throw new Error("Invalid Vercel team ID");
  }
  const entries = Object.entries(input.files);
  if (entries.length === 0 || entries.length > MAX_FILES) {
    throw new Error("Vercel deployment requires 1–500 source files");
  }
  let totalBytes = 0;
  for (const [path, content] of entries) {
    if (!safeSourcePath(path) || typeof content !== "string") {
      throw new Error("Invalid Vercel deployment source");
    }
    totalBytes += Buffer.byteLength(content);
    if (totalBytes > MAX_BYTES) throw new Error("Vercel source exceeds 15 MB");
  }

  const authHeaders = { Authorization: `Bearer ${input.token}` };
  const scope = input.teamId ? `?teamId=${encodeURIComponent(input.teamId)}` : "";
  const manifest: Array<{ file: string; sha: string; size: number }> = [];

  for (const [path, content] of entries) {
    const bytes = Buffer.from(content, "utf8");
    const sha = createHash("sha1").update(bytes).digest("hex");
    const upload = await fetcher(`${API}/v2/files${scope}`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/octet-stream",
        "x-vercel-digest": sha,
      },
      body: bytes,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!upload.ok) {
      // Never include provider response bodies: they may contain private data.
      throw new Error(`Vercel file upload failed (HTTP ${upload.status})`);
    }
    manifest.push({ file: path, sha, size: bytes.length });
  }

  const create = await fetcher(`${API}/v13/deployments${scope}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.projectName,
      project: input.projectName,
      target: "production",
      files: manifest,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!create.ok) {
    throw new Error(`Vercel deployment request failed (HTTP ${create.status})`);
  }
  const created = (await create.json()) as {
    id?: unknown;
    url?: unknown;
    readyState?: unknown;
  };
  if (
    typeof created.id !== "string" ||
    !/^dpl_[A-Za-z0-9]+$/.test(created.id) ||
    typeof created.url !== "string" ||
    !/^[a-zA-Z0-9.-]+\.vercel\.app$/.test(created.url)
  ) {
    throw new Error("Vercel returned an invalid deployment identity");
  }
  // Provider acceptance is not proof the deployed application is live.
  // Keep polling the exact deployment until Vercel reports READY; the router
  // then runs the existing HTTP and billing smoke checks.
  for (let attempt = 0; attempt < 24; attempt++) {
    const check = await fetcher(
      `${API}/v13/deployments/${encodeURIComponent(created.id)}${scope}`,
      {
        headers: authHeaders,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!check.ok) {
      throw new Error(`Vercel deployment status failed (HTTP ${check.status})`);
    }
    const status = (await check.json()) as { readyState?: unknown };
    if (status.readyState === "READY") {
      return { deploymentId: created.id, url: `https://${created.url}` };
    }
    if (status.readyState === "ERROR" || status.readyState === "CANCELED") {
      throw new Error("Vercel deployment failed to build");
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("Vercel deployment has not reached READY; inspect the deployment in your Vercel account");
}
