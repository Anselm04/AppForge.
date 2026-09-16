import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { ENV } from "../_core/env.js";
import { logger } from "../_core/logger.js";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

const LOCK_TTL_SECONDS = 2 * 60 * 60;

async function getClient(): Promise<RedisClientType | null> {
  if (!ENV.redisUrl) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    const next = createClient({ url: ENV.redisUrl }) as RedisClientType;
    next.on("error", (err) => logger.error({ err }, "self_healing_redis_error"));
    await next.connect();
    client = next;
    logger.info("Self-healing Redis coordination connected");
    return next;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export type SelfHealingClaim = {
  key: string;
  token: string;
};

/**
 * Acquire a production-wide recovery lease for one project.
 *
 * AppForge runs multiple Fly machines, so an in-memory Set cannot prevent two
 * machines from creating separate autonomous repair tasks for the same error.
 * Production already requires Redis for shared coordination; fail closed when
 * that coordination is unavailable rather than risk duplicate repairs/deploys.
 */
export async function claimSelfHealingProject(
  projectId: number,
): Promise<SelfHealingClaim | null> {
  const redis = await getClient();
  if (!redis) {
    logger.error({ projectId }, "self_healing_claim_unavailable_no_redis");
    return null;
  }

  const key = `appforge:self-healing:project:${projectId}`;
  const token = randomUUID();
  try {
    const claimed = await redis.set(key, token, {
      NX: true,
      EX: LOCK_TTL_SECONDS,
    });
    return claimed === "OK" ? { key, token } : null;
  } catch (err) {
    logger.error({ err, projectId }, "self_healing_claim_failed");
    return null;
  }
}

/** Release only the lease owned by this worker. */
export async function releaseSelfHealingProject(
  claim: SelfHealingClaim,
): Promise<void> {
  const redis = await getClient();
  if (!redis) return;
  try {
    await redis.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      { keys: [claim.key], arguments: [claim.token] },
    );
  } catch (err) {
    logger.error({ err, key: claim.key }, "self_healing_claim_release_failed");
  }
}
