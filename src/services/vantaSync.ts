import { logger } from "../_core/logger.js";
import { ENV } from "../_core/env.js";
import { createClient, type RedisClientType } from "redis";

const VANTA_API = "https://api.vanta.com/v1";

let vantaRedisClient: RedisClientType | null = null;
let vantaRedisConnectPromise: Promise<void> | null = null;

async function getVantaRedisClient(): Promise<RedisClientType> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error("REDIS_URL is required for production Vanta coordination");
  }

  if (!vantaRedisClient) {
    vantaRedisClient = createClient({ url: redisUrl }) as RedisClientType;
    vantaRedisClient.on("error", (error) => {
      logger.error({ error }, "vanta_redis_error");
    });
  }

  if (!vantaRedisClient.isOpen) {
    if (!vantaRedisConnectPromise) {
      vantaRedisConnectPromise = vantaRedisClient
        .connect()
        .then(() => undefined)
        .finally(() => {
          vantaRedisConnectPromise = null;
        });
    }
    await vantaRedisConnectPromise;
  }

  return vantaRedisClient;
}

/**
 * Claim one heartbeat slot for the redundant production fleet.
 *
 * Both Fly Machines run the same runtime bootstrap. Without a shared claim they
 * would submit duplicate Vanta heartbeat evidence every interval. The slot key
 * is stable across Machines and intentionally lives slightly longer than one
 * interval so only one process can emit evidence for that period.
 */
async function claimVantaHeartbeatSlot(intervalMs: number): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;

  const client = await getVantaRedisClient();
  const slot = Math.floor(Date.now() / intervalMs);
  const key = `appforge:vanta:heartbeat:${slot}`;
  const ttlMs = Math.max(intervalMs + 60_000, 120_000);
  const claimed = await client.set(key, process.env.FLY_MACHINE_ID || "appforge", {
    NX: true,
    PX: ttlMs,
  });
  return claimed === "OK";
}

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

/** Periodic heartbeat to Vanta when credentials are configured. */
export function startVantaPoller(intervalMs = 3_600_000): () => void {
  const workspaceId = ENV.vantaWorkspaceId || process.env.VANTA_WORKSPACE_ID;
  const token = ENV.vantaApiToken || process.env.VANTA_API_TOKEN;
  if (!workspaceId || !token) {
    return () => {};
  }

  const tick = async () => {
    try {
      if (!(await claimVantaHeartbeatSlot(intervalMs))) {
        logger.debug(
          { intervalMs },
          "vanta_poller_tick_skipped_other_machine_owns_slot",
        );
        return;
      }

      await syncComplianceToVanta(0, {
        type: "heartbeat",
        at: new Date().toISOString(),
        service: "appforge",
      });
    } catch (err) {
      // In production a coordination failure must fail closed for evidence
      // emission. Sending from both Machines would create misleading duplicate
      // compliance records, so log and retry on the next scheduled tick.
      logger.warn({ err }, "vanta_poller_tick_failed");
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  logger.info({ intervalMs }, "vanta_poller_started");
  return () => {
    clearInterval(timer);
    if (vantaRedisClient?.isOpen) {
      void vantaRedisClient.quit().catch((error) => {
        logger.warn({ error }, "vanta_redis_quit_failed");
      });
    }
  };
}
