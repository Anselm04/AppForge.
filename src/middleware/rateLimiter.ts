/**
 * Rate Limiting Middleware for AppForge
 *
 * Implements multi-tier rate limiting with:
 * - Global rate limiting (all routes)
 * - Auth rate limiting (login, register - stricter)
 * - API rate limiting (app endpoints)
 * - Redis-backed distributed rate limiting in production
 */

import rateLimit, {
  RateLimitRequestHandler,
  Options as RateLimitOptions,
} from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient, type RedisClientType } from "redis";

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  global: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, please try again later.",
  },
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many authentication attempts, please try again later.",
  },
  api: {
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: "API rate limit exceeded, please slow down.",
  },
  build: {
    windowMs: 60 * 60 * 1000,
    max: 20,
    message:
      "Build rate limit exceeded. Please wait before creating more builds.",
  },
};

let sharedRedisClient: RedisClientType | null = null;
let sharedRedisConnectPromise: Promise<void> | null = null;

function getRedisUrl(): string | null {
  const value = process.env.REDIS_URL?.trim();
  return value ? value : null;
}

async function getSharedRedisClient(): Promise<RedisClientType> {
  const url = getRedisUrl();
  if (!url) {
    throw new Error("REDIS_URL is required for distributed rate limiting");
  }

  if (!sharedRedisClient) {
    sharedRedisClient = createClient({ url }) as RedisClientType;
    sharedRedisClient.on("error", (error) => {
      console.error("Shared rate-limit Redis error", error);
    });
  }

  if (!sharedRedisClient.isOpen) {
    if (!sharedRedisConnectPromise) {
      sharedRedisConnectPromise = sharedRedisClient
        .connect()
        .then(() => undefined)
        .finally(() => {
          sharedRedisConnectPromise = null;
        });
    }
    await sharedRedisConnectPromise;
  }

  return sharedRedisClient;
}

function createDistributedStore(config: RateLimitConfig): RedisStore {
  // Each tier needs its own Redis namespace because the windows and maxima differ.
  // This value is deterministic across Fly Machines, so traffic routed to either
  // instance consumes the same bucket instead of doubling the effective limit.
  const prefix = `appforge:rate-limit:${config.windowMs}:${config.max}:`;
  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]) => {
      const client = await getSharedRedisClient();
      return client.sendCommand(args);
    },
  });
}

/**
 * Build a limiter identity exclusively from server-trusted state.
 *
 * This middleware is mounted before authentication for the global protection
 * layer, so caller-controlled headers such as x-api-key and x-user-id must never
 * create independent buckets. Otherwise an attacker can rotate arbitrary header
 * values to evade the limiter. Once trusted auth middleware has populated
 * req.user, an internal AppForge user ID is safe to use.
 */
export function rateLimitIdentity(req: any): string {
  const userId = req.user?.id;
  if (userId) return `user:${userId}`;

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function createOptions(config: RateLimitConfig): Partial<RateLimitOptions> {
  return {
    windowMs: config.windowMs,
    max: config.max,
    message: { error: config.message },
    standardHeaders: true,
    legacyHeaders: true,
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
    skipFailedRequests: config.skipFailedRequests ?? false,
    keyGenerator: rateLimitIdentity,
    validate: { xForwardedForHeader: true },
    handler: (_req: any, res: any, _next: any, opts: any) => {
      const retryAfter = Math.ceil(opts.windowMs / 1000);
      res.status(429).json({
        error: config.message,
        retryAfter,
        limit: opts.max,
        remaining: 0,
        resetTime: new Date(Date.now() + opts.windowMs).toISOString(),
      });
    },
    // Never permit a caller-controlled header to bypass production rate limits.
    // Tests bypass the limiter deterministically through NODE_ENV only.
    skip: () => process.env.NODE_ENV === "test",
  };
}

/**
 * Synchronous middleware constructor used while Express routes are assembled.
 * In production it still uses the shared Redis store: the store lazily awaits
 * one shared connection when a request first consumes a rate-limit bucket.
 */
export function createLocalRateLimiter(
  config: RateLimitConfig = DEFAULT_LIMITS.global,
): RateLimitRequestHandler {
  const options = createOptions(config) as RateLimitOptions;
  if (process.env.NODE_ENV === "production" && getRedisUrl()) {
    options.store = createDistributedStore(config);
  }
  return rateLimit(options);
}

/**
 * Create a limiter with optional Redis backing. Production callers always get
 * Redis when REDIS_URL is configured so independently routed requests cannot
 * obtain a fresh in-memory bucket on the second Fly Machine.
 */
export async function createRateLimiter(
  config: RateLimitConfig = DEFAULT_LIMITS.global,
  useRedis: boolean = false,
): Promise<RateLimitRequestHandler> {
  const options = createOptions(config) as RateLimitOptions;
  const shouldUseRedis =
    Boolean(getRedisUrl()) &&
    (useRedis || process.env.NODE_ENV === "production");

  if (shouldUseRedis) {
    await getSharedRedisClient();
    options.store = createDistributedStore(config);
  }

  return rateLimit(options);
}

/** Production readiness probe for the shared two-Machine coordination store. */
export async function checkSharedRedis(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    const client = await getSharedRedisClient();
    return (await client.ping()) === "PONG";
  } catch {
    return false;
  }
}

export const rateLimiters = {
  global: async () => createRateLimiter(DEFAULT_LIMITS.global),
  auth: async () => createRateLimiter(DEFAULT_LIMITS.auth),
  api: async () => createRateLimiter(DEFAULT_LIMITS.api),
  build: async () => createRateLimiter(DEFAULT_LIMITS.build),
};

export function getRateLimitConfig(
  tier: keyof typeof DEFAULT_LIMITS,
): RateLimitConfig {
  return DEFAULT_LIMITS[tier];
}

export function createCustomRateLimiter(config: Partial<RateLimitConfig>) {
  const fullConfig: RateLimitConfig = {
    ...DEFAULT_LIMITS.global,
    ...config,
  };
  return () => createRateLimiter(fullConfig);
}

export default rateLimiters;
