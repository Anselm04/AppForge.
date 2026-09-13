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
    ok: root.ok && assets.every((asset) => asset.result.ok) && (health ? health.ok : true),
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
