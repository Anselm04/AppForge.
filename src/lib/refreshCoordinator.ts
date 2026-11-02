import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { logger } from "../_core/logger.js";

const LOCK_TTL_SECONDS = 10;
const RESULT_TTL_SECONDS = 15;
const WAIT_TIMEOUT_MS = 4_000;
const POLL_INTERVAL_MS = 80;
const KEY_PREFIX = "appforge:auth-refresh";

type JsonObject = Record<string, unknown>;

type RefreshStore = {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { EX?: number; NX?: boolean },
  ): Promise<string | null>;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
};

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<RedisClientType | null> | null = null;

async function productionRedisStore(): Promise<RefreshStore | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (redisClient?.isReady) return redisClient as unknown as RefreshStore;
  if (redisConnectPromise) return redisConnectPromise;

  redisConnectPromise = (async () => {
    const client = createClient({ url });
    client.on("error", (error) =>
      logger.error({ error }, "auth_refresh_redis_error"),
    );
    try {
      await client.connect();
      redisClient = client;
      return client;
    } catch (error) {
      logger.error({ error }, "auth_refresh_redis_connect_failed");
      try {
        client.destroy();
      } catch {
        // Connection cleanup is best-effort; authentication remains fail-closed.
      }
      return null;
    } finally {
      redisConnectPromise = null;
    }
  })();

  return redisConnectPromise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCached<T extends JsonObject>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function releaseOwnedLock(
  store: RefreshStore,
  lockKey: string,
  owner: string,
): Promise<void> {
  const script =
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
  await store.eval(script, { keys: [lockKey], arguments: [owner] });
}

/**
 * Serialize one-time Supabase refresh-token rotation across separate Node
 * processes. Callers pass only a SHA-256 digest as key material; the raw
 * refresh token never enters Redis, logs, keys, or this coordinator.
 */
export async function coordinateRefreshAcrossMachines<T extends JsonObject>(
  tokenDigest: string,
  refresh: () => Promise<T | null>,
  storeOverride?: RefreshStore | null,
): Promise<T | null> {
  const hasConfiguredRedis = Boolean(process.env.REDIS_URL?.trim());
  const store =
    storeOverride === undefined ? await productionRedisStore() : storeOverride;

  if (!store) {
    if (process.env.NODE_ENV === "production" && hasConfiguredRedis) {
      logger.warn({}, "auth_refresh_coordination_unavailable");
      return null;
    }
    // Local/test environments without REDIS_URL keep the existing single-process
    // behavior. Production requires REDIS_URL at the release gate.
    return refresh();
  }

  const lockKey = `${KEY_PREFIX}:lock:${tokenDigest}`;
  const resultKey = `${KEY_PREFIX}:result:${tokenDigest}`;
  const cached = parseCached<T>(await store.get(resultKey));
  if (cached) return cached;

  const owner = randomUUID();
  const acquired = await store.set(lockKey, owner, {
    EX: LOCK_TTL_SECONDS,
    NX: true,
  });

  if (acquired === "OK") {
    try {
      const result = await refresh();
      if (result) {
        await store.set(resultKey, JSON.stringify(result), {
          EX: RESULT_TTL_SECONDS,
        });
      }
      return result;
    } finally {
      try {
        await releaseOwnedLock(store, lockKey, owner);
      } catch (error) {
        logger.warn({ error }, "auth_refresh_lock_release_failed");
      }
    }
  }

  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const result = parseCached<T>(await store.get(resultKey));
    if (result) return result;
  }

  logger.warn({}, "auth_refresh_coordination_wait_timeout");
  return null;
}
