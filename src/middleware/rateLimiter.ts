/**
 * Rate Limiting Middleware for AppForge
 *
 * Implements multi-tier rate limiting with:
 * - Global rate limiting (all routes)
 * - Auth rate limiting (login, register - stricter)
 * - API rate limiting (app endpoints)
 * - Redis-backed distributed rate limiting (optional)
 */

import { createHash } from "node:crypto";
import rateLimit, {
  RateLimitRequestHandler,
  Options as RateLimitOptions,
} from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";

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

/**
 * Build a non-secret limiter identity. Authenticated users are partitioned by
 * internal user ID; API keys are hashed before they ever become memory/Redis
 * keys so operational inspection cannot reveal bearer credentials.
 */
export function rateLimitIdentity(req: any): string {
  const userId = req.user?.id;
  if (userId) return `user:${userId}`;

  const apiKey = req.headers?.["x-api-key"] as string | undefined;
  if (apiKey) {
    const digest = createHash("sha256").update(apiKey).digest("hex");
    return `api-key-sha256:${digest}`;
  }

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
 * Synchronous in-memory limiter for middleware that must be mounted in a
 * deterministic order during Express app construction.
 */
export function createLocalRateLimiter(
  config: RateLimitConfig = DEFAULT_LIMITS.global,
): RateLimitRequestHandler {
  return rateLimit(createOptions(config) as RateLimitOptions);
}

/**
 * Create a limiter with optional Redis backing. Callers that need deterministic
 * route ordering should use createLocalRateLimiter, or await this function before
 * mounting any routes that the limiter is expected to protect.
 */
export async function createRateLimiter(
  config: RateLimitConfig = DEFAULT_LIMITS.global,
  useRedis: boolean = false,
): Promise<RateLimitRequestHandler> {
  const options = createOptions(config) as RateLimitOptions;

  if (useRedis && process.env.REDIS_URL) {
    const redisClient = createClient({ url: process.env.REDIS_URL });
    try {
      await redisClient.connect();
      options.store = new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      });
    } catch (error) {
      await redisClient.disconnect().catch(() => undefined);
      // Falling back to the process-local store preserves availability, while
      // callers still retain per-instance abuse protection.
      console.warn(
        "Redis connection failed for rate limiter; using memory store",
        error,
      );
    }
  }

  return rateLimit(options);
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
