import {
  APPFORGE_INTEGRATIONS,
  type AppForgeIntegrationDefinition,
  type AppForgeIntegrationKind,
} from "./catalog.js";

export type IntegrationConnectionState =
  | "connected"
  | "needs_attention"
  | "not_connected"
  | "configuration_required";

export type IntegrationHealth = {
  id: string;
  name: string;
  kind: AppForgeIntegrationKind;
  job: string;
  capabilities: string[];
  state: IntegrationConnectionState;
  configured: boolean;
  verified: boolean;
  requiredForProduction: boolean;
  lastCheckedAt: string;
  message: string;
};

const INTERNAL_IMPLEMENTED = new Set([
  "deep-research",
  "documents",
  "default-templates",
  "pdf",
  "plugin-management",
  "presentations",
  "security",
  "spreadsheets",
  "template-creator",
]);

const value = (name: string) => process.env[name]?.trim() || "";
const any = (...names: string[]) => names.some((name) => Boolean(value(name)));

function result(
  definition: AppForgeIntegrationDefinition,
  state: IntegrationConnectionState,
  message: string,
  configured = false,
  verified = false,
): IntegrationHealth {
  return {
    id: definition.id,
    name: definition.name,
    kind: definition.kind,
    job: definition.job,
    capabilities: definition.capabilities,
    state,
    configured,
    verified,
    requiredForProduction: definition.requiredForProduction,
    lastCheckedAt: new Date().toISOString(),
    message,
  };
}

async function probe(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; message: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, status: 0, message: "Invalid verification URL" };
  }

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    return {
      ok: false,
      status: 0,
      message: "Production verification URL must use HTTPS",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(parsed, {
      ...init,
      signal: controller.signal,
      redirect: "manual",
    });
    const ok = response.status >= 200 && response.status < 400;
    return {
      ok,
      status: response.status,
      message: ok
        ? `Verified with HTTP ${response.status}`
        : `Verification returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message:
        error instanceof Error ? error.message : "Verification request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyRemote(
  definition: AppForgeIntegrationDefinition,
): Promise<IntegrationHealth> {
  const fail = (message: string, configured = true) =>
    result(definition, "needs_attention", message, configured, false);
  const pass = (message: string) =>
    result(definition, "connected", message, true, true);

  switch (definition.id) {
    case "github": {
      const token = value("GITHUB_TOKEN");
      if (!token) {
        return result(
          definition,
          "not_connected",
          "GITHUB_TOKEN is not configured",
        );
      }
      const check = await probe("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "AppForge-Integration-Health",
        },
      });
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "stripe": {
      const secret = value("STRIPE_SECRET_KEY");
      const webhookSecret = value("STRIPE_WEBHOOK_SECRET");
      if (!secret && !webhookSecret) {
        return result(
          definition,
          "not_connected",
          "Stripe is not configured",
        );
      }
      if (!secret || !webhookSecret) {
        return result(
          definition,
          "configuration_required",
          "Stripe requires both API and webhook secrets",
          true,
        );
      }
      const check = await probe("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "vercel": {
      const token = value("VERCEL_TOKEN");
      if (!token) {
        return result(
          definition,
          "not_connected",
          "VERCEL_TOKEN is not configured",
        );
      }
      const check = await probe("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "supabase": {
      const url = value("SUPABASE_URL") || value("VITE_SUPABASE_URL");
      const key =
        value("SUPABASE_ANON_KEY") ||
        value("VITE_SUPABASE_PUBLISHABLE_KEY") ||
        value("VITE_SUPABASE_ANON_KEY");
      if (!url && !key) {
        return result(
          definition,
          "not_connected",
          "Supabase is not configured",
        );
      }
      if (!url || !key) {
        return result(
          definition,
          "configuration_required",
          "Supabase URL and publishable key are required",
          true,
        );
      }
      const check = await probe(`${url.replace(/\/$/, "")}/auth/v1/health`, {
        headers: { apikey: key },
      });
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "twilio": {
      const sid = value("TWILIO_ACCOUNT_SID");
      const token = value("TWILIO_AUTH_TOKEN");
      if (!sid && !token) {
        return result(
          definition,
          "not_connected",
          "Twilio is not configured",
        );
      }
      if (!sid || !token) {
        return result(
          definition,
          "configuration_required",
          "Twilio account SID and auth token are required",
          true,
        );
      }
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const check = await probe(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "datadog": {
      const apiKey = value("DD_API_KEY");
      const site = value("DD_SITE") || "datadoghq.com";
      if (!apiKey) {
        return result(
          definition,
          "not_connected",
          "DD_API_KEY is not configured",
        );
      }
      const check = await probe(`https://api.${site}/api/v1/validate`, {
        headers: { "DD-API-KEY": apiKey },
      });
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "posthog": {
      const host = value("POSTHOG_HOST") || value("VITE_POSTHOG_HOST");
      const token = value("POSTHOG_PERSONAL_API_KEY");
      const projectId = value("POSTHOG_PROJECT_ID");
      if (!host && !token && !projectId) {
        return result(
          definition,
          "not_connected",
          "PostHog verification is not configured",
        );
      }
      if (!host || !token || !projectId) {
        return result(
          definition,
          "configuration_required",
          "PostHog verification requires host, personal API key, and project ID",
          true,
        );
      }
      const check = await probe(
        `${host.replace(/\/$/, "")}/api/projects/${encodeURIComponent(projectId)}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "sprites-fly": {
      const appName = value("FLY_APP_NAME");
      if (!appName) {
        return result(
          definition,
          "not_connected",
          "FLY_APP_NAME is not configured",
        );
      }
      const check = await probe(`https://${appName}.fly.dev/api/health/live`);
      return check.ok
        ? pass("Fly.io runtime verified; Sprites connector remains separately managed")
        : fail(check.message);
    }

    case "make": {
      if (!any("MAKE_API_TOKEN", "MAKE_WEBHOOK_URL", "MAKE_HEALTH_URL")) {
        return result(
          definition,
          "not_connected",
          "Make is not configured",
        );
      }
      const healthUrl = value("MAKE_HEALTH_URL");
      const token = value("MAKE_API_TOKEN");
      if (!healthUrl || !token) {
        return result(
          definition,
          "configuration_required",
          "Make runtime exists, but safe health verification still needs MAKE_HEALTH_URL and MAKE_API_TOKEN",
          true,
        );
      }
      const check = await probe(healthUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "bubblav": {
      if (!any("BUBBLAV_API_KEY", "BUBBLAV_CHAT_URL", "BUBBLAV_HEALTH_URL")) {
        return result(
          definition,
          "not_connected",
          "BubblaV is not configured",
        );
      }
      const healthUrl = value("BUBBLAV_HEALTH_URL");
      const apiKey = value("BUBBLAV_API_KEY");
      if (!healthUrl || !apiKey) {
        return result(
          definition,
          "configuration_required",
          "BubblaV runtime exists, but safe health verification still needs BUBBLAV_HEALTH_URL and BUBBLAV_API_KEY",
          true,
        );
      }
      const check = await probe(healthUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "codex-security": {
      const healthUrl = value("CODEX_SECURITY_WEBHOOK_URL");
      const token = value("CODEX_SECURITY_TOKEN");
      if (!healthUrl && !token) {
        return result(
          definition,
          "not_connected",
          "Codex Security runtime bridge is not configured",
        );
      }
      return result(
        definition,
        "configuration_required",
        "ChatGPT Codex Security is not a deployable AppForge API; an approved runtime endpoint is still required",
        true,
      );
    }

    case "marketing-app": {
      const url = value("MARKETING_APP_URL");
      const secret = value("TRILLION_ECOSYSTEM_SHARED_SECRET");
      if (!url && !secret) {
        return result(
          definition,
          "not_connected",
          "Marketing app bridge is not configured",
        );
      }
      if (!url || !secret) {
        return result(
          definition,
          "configuration_required",
          "Marketing app URL and ecosystem shared secret are required",
          true,
        );
      }
      const check = await probe(`${url.replace(/\/$/, "")}/health`);
      return check.ok ? pass(check.message) : fail(check.message);
    }

    case "trillionaitech-site": {
      const url = value("TRILLION_PUBLIC_SITE_URL");
      if (!url) {
        return result(
          definition,
          "not_connected",
          "TRILLION_PUBLIC_SITE_URL is not configured",
        );
      }
      const check = await probe(url);
      return check.ok ? pass(check.message) : fail(check.message);
    }

    default:
      return result(
        definition,
        "configuration_required",
        "No safe runtime verifier has been configured for this integration",
        definition.env.some((name) => Boolean(value(name))),
      );
  }
}

export async function verifyIntegration(
  definition: AppForgeIntegrationDefinition,
): Promise<IntegrationHealth> {
  if (definition.kind === "internal") {
    if (INTERNAL_IMPLEMENTED.has(definition.id)) {
      return result(
        definition,
        "connected",
        "Capability is implemented inside AppForge",
        true,
        true,
      );
    }
    return result(
      definition,
      "configuration_required",
      "Capability is registered but its production implementation is not yet verified",
      false,
      false,
    );
  }

  return verifyRemote(definition);
}

export async function verifyAllIntegrations(): Promise<IntegrationHealth[]> {
  const settled = await Promise.allSettled(
    APPFORGE_INTEGRATIONS.map((definition) => verifyIntegration(definition)),
  );
  return settled.map((entry, index) => {
    if (entry.status === "fulfilled") return entry.value;
    const definition = APPFORGE_INTEGRATIONS[index];
    return result(
      definition,
      "needs_attention",
      "Verification failed unexpectedly",
      true,
      false,
    );
  });
}

export async function summarizeIntegrationHealth() {
  const integrations = await verifyAllIntegrations();
  const required = integrations.filter(
    (integration) => integration.requiredForProduction,
  );
  return {
    productionReady: required.every(
      (integration) => integration.state === "connected",
    ),
    connected: integrations.filter(
      (integration) => integration.state === "connected",
    ).length,
    total: integrations.length,
    requiredConnected: required.filter(
      (integration) => integration.state === "connected",
    ).length,
    requiredTotal: required.length,
    integrations,
  };
}
