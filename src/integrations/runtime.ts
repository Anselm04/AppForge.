type JsonRecord = Record<string, unknown>;

type RequestOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

function value(name: string): string {
  return process.env[name]?.trim() || "";
}

function requireHttpsInProduction(url: string): URL {
  const parsed = new URL(url);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("Production integration endpoints must use HTTPS");
  }
  return parsed;
}

async function requestJson(url: string, options: RequestOptions = {}) {
  const parsed = requireHttpsInProduction(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

  try {
    const response = await fetch(parsed, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      redirect: "manual",
    });

    const raw = await response.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw.slice(0, 2_000);
      }
    }

    if (!response.ok) {
      const error = new Error(`Integration request failed with HTTP ${response.status}`) as Error & {
        statusCode?: number;
      };
      error.statusCode = response.status;
      throw error;
    }

    return { status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runMakeWorkflow(input: {
  event: string;
  payload: JsonRecord;
  actor: { id: number; email: string };
}) {
  const webhookUrl = value("MAKE_WEBHOOK_URL");
  if (!webhookUrl) throw new Error("Make webhook is not configured");

  const token = value("MAKE_API_TOKEN");
  return requestJson(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-appforge-event": input.event,
    },
    body: {
      event: input.event,
      payload: input.payload,
      actor: input.actor,
      source: "appforge",
      occurredAt: new Date().toISOString(),
    },
    timeoutMs: 30_000,
  });
}

export async function sendBubblaVSupportMessage(input: {
  message: string;
  actor: { id: number; email: string; name?: string | null };
  context?: JsonRecord;
}) {
  const chatUrl = value("BUBBLAV_CHAT_URL") || value("BUBBLAV_API_URL");
  const apiKey = value("BUBBLAV_API_KEY");
  if (!chatUrl || !apiKey) {
    throw new Error("BubblaV support endpoint is not configured");
  }

  return requestJson(chatUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: {
      message: input.message,
      user: input.actor,
      context: input.context ?? {},
      source: "appforge",
    },
    timeoutMs: 30_000,
  });
}

export async function capturePostHogEvent(input: {
  event: string;
  distinctId: string;
  properties?: JsonRecord;
}) {
  const host = value("POSTHOG_HOST") || value("VITE_POSTHOG_HOST");
  const apiKey = value("POSTHOG_KEY") || value("VITE_POSTHOG_KEY");
  if (!host || !apiKey) throw new Error("PostHog capture is not configured");

  return requestJson(`${host.replace(/\/$/, "")}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: {
      api_key: apiKey,
      event: input.event,
      properties: {
        distinct_id: input.distinctId,
        ...(input.properties ?? {}),
      },
    },
  });
}

export async function sendDatadogLog(input: {
  message: string;
  level?: "debug" | "info" | "warn" | "error";
  attributes?: JsonRecord;
}) {
  const apiKey = value("DD_API_KEY");
  const site = value("DD_SITE") || "datadoghq.com";
  if (!apiKey) throw new Error("Datadog log intake is not configured");

  return requestJson(`https://http-intake.logs.${site}/api/v2/logs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "DD-API-KEY": apiKey,
    },
    body: [
      {
        message: input.message,
        service: "appforge",
        source: "nodejs",
        status: input.level ?? "info",
        hostname: value("FLY_APP_NAME") || "appforge",
        ...(input.attributes ?? {}),
      },
    ],
  });
}

export async function runSpritesAgentTask(input: {
  task: string;
  actor: { id: number; email: string };
  projectId?: number;
  context?: JsonRecord;
}) {
  const execUrl = value("SPRITES_EXEC_URL");
  const token = value("SPRITES_API_TOKEN");
  if (!execUrl || !token) {
    throw new Error("Sprites execution bridge is not configured");
  }

  return requestJson(execUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-appforge-agent-runtime": "sprites",
    },
    body: {
      task: input.task,
      actor: input.actor,
      projectId: input.projectId,
      context: input.context ?? {},
      source: "appforge",
      requestedAt: new Date().toISOString(),
    },
    timeoutMs: 60_000,
  });
}

export async function runCodexSecurityReview(input: {
  actor: { id: number; email: string };
  project: {
    id: number;
    title: string;
    description: string;
    techStack: string;
    generatedFiles: unknown;
  };
  focus?: string;
}) {
  const execUrl =
    value("CODEX_SECURITY_EXEC_URL") || value("CODEX_SECURITY_WEBHOOK_URL");
  const token = value("CODEX_SECURITY_TOKEN");
  if (!execUrl || !token) {
    throw new Error("Codex Security execution bridge is not configured");
  }

  return requestJson(execUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-appforge-security-runtime": "codex-security",
    },
    body: {
      actor: input.actor,
      project: input.project,
      focus: input.focus,
      source: "appforge",
      requestedAt: new Date().toISOString(),
    },
    timeoutMs: 90_000,
  });
}
