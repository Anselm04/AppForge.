export type HealthCheckResult = {
  ok: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
};

export async function probeDeployUrl(
  url: string,
  timeoutMs = 15_000,
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
    clearTimeout(timer);
    return {
      ok: res.ok || res.status < 500,
      statusCode: res.status,
      latencyMs: Date.now() - start,
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

/** Post-deploy smoke test — probes root and optional /health. */
export async function runPostDeploySmokeTest(deployUrl: string): Promise<{
  ok: boolean;
  root: HealthCheckResult;
  health?: HealthCheckResult;
}> {
  const root = await probeDeployUrl(deployUrl.replace(/\/$/, ""));
  const healthUrl = `${deployUrl.replace(/\/$/, "")}/health`;
  let health: HealthCheckResult | undefined;
  try {
    health = await probeDeployUrl(healthUrl, 10_000);
  } catch {
    health = undefined;
  }
  const ok = root.ok && (health ? health.ok : true);
  return { ok, root, health };
}
