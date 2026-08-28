import { logger } from "../_core/logger.js";
import { ENV } from "../_core/env.js";

const VANTA_API = "https://api.vanta.com/v1";

export async function syncComplianceToVanta(
  projectId: number,
  compliancePayload: Record<string, unknown>,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const workspaceId = ENV.vantaWorkspaceId || process.env.VANTA_WORKSPACE_ID;
  const token = ENV.vantaApiToken || process.env.VANTA_API_TOKEN;
  if (!workspaceId || !token) {
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch(`${VANTA_API}/workspaces/${workspaceId}/evidence`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `AppForge project ${projectId} compliance export`,
        description: "Auto-exported compliance scaffolding from AppForge build",
        metadata: compliancePayload,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn({ projectId, status: res.status, body }, "vanta_sync_failed");
      return { ok: false, error: body.slice(0, 200) };
    }
    logger.info({ projectId }, "vanta_sync_ok");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
