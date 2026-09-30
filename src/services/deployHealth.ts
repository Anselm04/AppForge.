export type PreviewVerificationResult = {
  ok: boolean;
  statusCode?: number;
  snapshotId?: number;
  artifactVersion?: number;
  artifactSha256?: string;
  message?: string;
};

export async function verifyGeneratedPreview(input: {
  url: string;
  snapshotId: number;
  artifactVersion: number;
  artifactSha256: string;
}): Promise<PreviewVerificationResult> {
  try {
    const boundary = await fetch(input.url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "AppForge-Preview-Verification/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    const snapshotId = Number(
      boundary.headers.get("x-appforge-snapshot-id"),
    );
    const artifactVersion = Number(
      boundary.headers.get("x-appforge-artifact-version"),
    );
    const artifactSha256 =
      boundary.headers.get("x-appforge-artifact-sha256") ?? undefined;
    const identityMatches =
      snapshotId === input.snapshotId &&
      artifactVersion === input.artifactVersion &&
      artifactSha256 === input.artifactSha256;

    if (!identityMatches) {
      return {
        ok: false,
        statusCode: boundary.status,
        snapshotId,
        artifactVersion,
        artifactSha256,
        message:
          "Preview boundary did not serve the exact persisted artifact identity.",
      };
    }

    let runtimeResponse = boundary;
    if (boundary.status >= 300 && boundary.status < 400) {
      const location = boundary.headers.get("location");
      if (!location) {
        return {
          ok: false,
          statusCode: boundary.status,
          snapshotId,
          artifactVersion,
          artifactSha256,
          message: "Preview redirected without a runtime location.",
        };
      }
      runtimeResponse = await fetch(new URL(location, input.url), {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": "AppForge-Preview-Verification/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
    }

    const body = await runtimeResponse.text();
    const ok =
      runtimeResponse.ok &&
      body.trim().length > 0 &&
      identityMatches;

    return {
      ok,
      statusCode: runtimeResponse.status,
      snapshotId,
      artifactVersion,
      artifactSha256,
      message: ok
        ? undefined
        : "Preview runtime did not return a successful non-empty product response.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Preview verification failed",
    };
  }
}

export type HealthCheckResult = {
  ok: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
  body?: string;
};

export function isSuccessfulDeployStatus(status: number): boolean {
  return status >= 200 && status < 400;
}

export async function probeDeployUrl(
  url: string,
  timeoutMs = 15_000,
  requireBody = false,
): Promise<HealthCheckResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "AppForge-Deploy-Health/1.0" },
    });
    const successfulStatus = isSuccessfulDeployStatus(res.status);
    let hasBody = true;
    let body: string | undefined;
    if (successfulStatus && requireBody) {
      body = await res.text();
      hasBody = body.trim().length > 0;
    }
    clearTimeout(timer);
    return {
      ok: successfulStatus && hasBody,
      statusCode: res.status,
      latencyMs: Date.now() - start,
      error: successfulStatus && !hasBody ? "Empty response body" : undefined,
      body,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Probe failed",
    };
  }
}

function sameOriginAssetUrls(baseUrl: string, html: string): string[] {
  const base = new URL(baseUrl);
  const urls = new Set<string>();
  const refs = html.matchAll(/(?:src|href)=["']([^"']+)["']/gi);

  for (const match of refs) {
    const ref = match[1]?.trim();
    if (!ref || ref.startsWith("data:") || ref.startsWith("#")) continue;
    try {
      const url = new URL(ref, base);
      if (url.origin !== base.origin) continue;
      if (!/\.(?:js|mjs|css)(?:$|[?#])/i.test(url.href)) continue;
      urls.add(url.href);
      if (urls.size >= 12) break;
    } catch {
      // Ignore malformed non-critical references; generated build validation
      // catches source-level issues before this production smoke gate runs.
    }
  }

  return [...urls];
}

export type AssetProbeResult = {
  url: string;
  result: HealthCheckResult;
};

export async function probeGeneratedProductAssets(
  deployUrl: string,
  html: string,
): Promise<AssetProbeResult[]> {
  const urls = sameOriginAssetUrls(deployUrl, html);
  return Promise.all(
    urls.map(async (url) => ({
      url,
      result: await probeDeployUrl(url, 10_000, false),
    })),
  );
}

/** Infer env vars the generated app likely needs from file contents. */
export function detectRequiredEnvVars(files: Record<string, string>): string[] {
  const found = new Set<string>();
  const text = Object.values(files).join("\n");
  const re =
    /process\.env\.([A-Z][A-Z0-9_]+)|import\.meta\.env\.([A-Z][A-Z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const key = m[1] ?? m[2];
    if (key && !key.startsWith("NODE_") && key !== "MODE") found.add(key);
  }
  if (text.includes("DATABASE_URL") || text.includes("drizzle"))
    found.add("DATABASE_URL");
  if (text.includes("SUPABASE") || text.includes("supabase"))
    found.add("VITE_SUPABASE_URL");
  if (text.includes("stripe") || text.includes("STRIPE"))
    found.add("STRIPE_SECRET_KEY");
  return [...found].sort();
}

/**
 * Post-deploy smoke test — root must render non-empty content, all same-origin
 * JS/CSS assets referenced by that root must load, and /health is optional.
 */
export async function runPostDeploySmokeTest(deployUrl: string): Promise<{
  ok: boolean;
  root: HealthCheckResult;
  assets: AssetProbeResult[];
  health?: HealthCheckResult;
}> {
  const base = deployUrl.replace(/\/$/, "");
  const root = await probeDeployUrl(base, 15_000, true);
  if (!root.ok) return { ok: false, root, assets: [] };

  const assets = await probeGeneratedProductAssets(base, root.body ?? "");
  if (assets.some((asset) => !asset.result.ok)) {
    return { ok: false, root, assets };
  }

  const healthProbe = await probeDeployUrl(`${base}/health`, 10_000);
  const health =
    healthProbe.statusCode === 404 || healthProbe.statusCode === 405
      ? undefined
      : healthProbe;

  return {
    ok:
      root.ok &&
      assets.every((asset) => asset.result.ok) &&
      (health ? health.ok : true),
    root,
    assets,
    health,
  };
}

type RouteProbe = {
  path: string;
  method: "GET" | "POST";
  ok: boolean;
  statusCode?: number;
  note?: string;
};

/** Probe billing routes exist (404 = broken; 400/405/503 = route wired). */
export async function runBillingRouteSmokeTest(
  deployUrl: string,
): Promise<{ ok: boolean; routes: RouteProbe[] }> {
  const base = deployUrl.replace(/\/$/, "");
  const probes: Array<{ path: string; method: "GET" | "POST" }> = [
    { path: "/pricing", method: "GET" },
    { path: "/api/checkout", method: "POST" },
    { path: "/api/webhooks/stripe", method: "POST" },
    { path: "/api/billing/me", method: "GET" },
  ];

  const routes: RouteProbe[] = [];
  for (const probe of probes) {
    try {
      const res = await fetch(`${base}${probe.path}`, {
        method: probe.method,
        headers:
          probe.method === "POST"
            ? { "Content-Type": "application/json" }
            : undefined,
        body: probe.method === "POST" ? "{}" : undefined,
        signal: AbortSignal.timeout(12_000),
      });
      const ok = res.status !== 404 && res.status !== 502;
      routes.push({
        path: probe.path,
        method: probe.method,
        ok,
        statusCode: res.status,
        note: ok ? "route reachable" : "route missing or gateway error",
      });
    } catch (err) {
      routes.push({
        path: probe.path,
        method: probe.method,
        ok: false,
        note: err instanceof Error ? err.message : "probe failed",
      });
    }
  }

  const ok = routes.every((r) => r.ok);
  return { ok, routes };
}

export type BillingVerificationResult = {
  ok: boolean;
  configured: boolean;
  verified: boolean;
  state?: string;
  statusCode?: number;
  message?: string;
};

/**
 * Verify the deployed generated app is connected to its billing provider.
 * This is stronger than route-existence smoke testing: the generated health
 * endpoint must report configured=true, verified=true and state=connected.
 */
export async function verifyDeployedBilling(
  deployUrl: string,
): Promise<BillingVerificationResult> {
  const base = deployUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/billing/health`, {
      method: "GET",
      headers: { "User-Agent": "AppForge-Billing-Verification/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    let payload: Record<string, unknown> = {};
    try {
      payload = (await res.json()) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        configured: false,
        verified: false,
        statusCode: res.status,
        message: "Billing health endpoint returned invalid JSON",
      };
    }

    const configured = payload.configured === true;
    const verified = payload.verified === true;
    const state = typeof payload.state === "string" ? payload.state : undefined;
    const ok = res.ok && configured && verified && state === "connected";

    return {
      ok,
      configured,
      verified,
      state,
      statusCode: res.status,
      message:
        typeof payload.message === "string" ? payload.message : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      configured: false,
      verified: false,
      message: err instanceof Error ? err.message : "Billing probe failed",
    };
  }
}
