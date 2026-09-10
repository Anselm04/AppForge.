import { createHmac } from "node:crypto";

export type MarketingBridgeMode = "draft" | "generate";

export type MarketingBridgePayload = {
  source: "appforge";
  sourceProjectId: number;
  sourceProjectCreatedAt: string | null;
  sourceUserEmail: string;
  sourceUserName: string;
  productName: string;
  description: string;
  techStack: string;
  productUrl?: string;
  mode: MarketingBridgeMode;
};

function bridgeConfig() {
  const baseUrl = process.env.MARKETING_APP_URL?.trim();
  const secret = process.env.TRILLION_ECOSYSTEM_SHARED_SECRET?.trim();
  if (!baseUrl || !secret) {
    throw new Error("Marketing bridge is not configured");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), secret };
}

export function signEcosystemPayload(
  secret: string,
  timestamp: string,
  body: string,
) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function sendProjectToMarketing(payload: MarketingBridgePayload) {
  const { baseUrl, secret } = bridgeConfig();
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = signEcosystemPayload(secret, timestamp, body);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    payload.mode === "generate" ? 120_000 : 20_000,
  );

  try {
    const response = await fetch(
      `${baseUrl}/api/integrations/appforge/campaign`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-trillion-source": "appforge",
          "x-trillion-timestamp": timestamp,
          "x-trillion-signature": signature,
        },
        body,
        signal: controller.signal,
      },
    );

    const raw = await response.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const publicMessage =
        parsed &&
        typeof parsed === "object" &&
        "error" in parsed &&
        typeof (parsed as { error?: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : `Marketing service returned HTTP ${response.status}`;
      const error = new Error(publicMessage) as Error & {
        statusCode?: number;
      };
      error.statusCode = response.status;
      throw error;
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}
