import { createTRPCUntypedClient, httpLink } from "@trpc/client";

const baseUrl = (process.env.APPFORGE_URL || "https://appforge-unfurling-moon-9058.fly.dev").replace(/\/$/, "");
const email = process.env.APPFORGE_CANARY_EMAIL;
const password = process.env.APPFORGE_CANARY_PASSWORD;
const REQUIRED_RUNTIME_INTEGRATIONS = ["supabase", "stripe", "sprites-fly"];

function required(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readRuntimeConfig() {
  const res = await fetchWithTimeout(`${baseUrl}/config.js`);
  if (!res.ok) throw new Error(`Runtime config failed: HTTP ${res.status}`);
  const text = await res.text();
  const match = text.match(/window\.__APPFORGE_CONFIG__=(\{.*\});?\s*$/s);
  if (!match) throw new Error("Unable to parse AppForge runtime config");
  const config = JSON.parse(match[1]);
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error("Production runtime config is missing Supabase public configuration");
  }
  return config;
}

async function login(config) {
  const res = await fetchWithTimeout(
    `${String(config.supabaseUrl).replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${config.supabasePublishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Production login failed: HTTP ${res.status}`);
  }
  return body.access_token;
}

async function getCsrf() {
  const res = await fetchWithTimeout(`${baseUrl}/api/csrf-token`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CSRF token request failed: HTTP ${res.status}`);
  const body = await res.json();
  const setCookie = res.headers.get("set-cookie");
  if (!body.csrfToken || !setCookie) throw new Error("CSRF boundary did not return token and signed cookie");
  return { csrfToken: body.csrfToken, cookie: setCookie.split(";")[0] };
}

function trpcClient(accessToken, csrf) {
  return createTRPCUntypedClient({
    links: [
      httpLink({
        url: `${baseUrl}/api/trpc`,
        headers: () => ({
          Authorization: `Bearer ${accessToken}`,
          "x-csrf-token": csrf.csrfToken,
          Cookie: csrf.cookie,
          Accept: "application/json",
        }),
      }),
    ],
  });
}

async function main() {
  required("APPFORGE_CANARY_EMAIL", email);
  required("APPFORGE_CANARY_PASSWORD", password);

  const config = await readRuntimeConfig();
  const accessToken = await login(config);
  const csrf = await getCsrf();
  const trpc = trpcClient(accessToken, csrf);
  const health = await trpc.query("ecosystem.integrations");
  const integrations = Array.isArray(health?.integrations) ? health.integrations : [];

  const checks = REQUIRED_RUNTIME_INTEGRATIONS.map((id) => {
    const item = integrations.find((entry) => entry?.id === id);
    return {
      id,
      present: Boolean(item),
      state: item?.state ?? "missing",
      verified: item?.verified === true,
      message: item?.message ?? "Integration missing from production health report",
    };
  });

  const failures = checks.filter((item) => !item.present || item.state !== "connected" || !item.verified);
  if (failures.length > 0) {
    throw new Error(`Critical production integrations are not verified: ${JSON.stringify(failures)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    requiredRuntimeIntegrations: checks,
    connectedCount: health?.connected ?? null,
    totalCount: health?.total ?? null,
  }, null, 2));
}

main().catch((error) => {
  console.error("[integration-preflight] FAILED", error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
