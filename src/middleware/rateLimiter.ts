/**
 * Rate Limiting Middleware for AppForge
 * 
 * Implements multi-tier rate limiting with:
 * - Global rate limiting (all routes)
 * - Auth rate limiting (login, register - stricter)
 * - API rate limiting (app endpoints)
 * - Redis-backed distributed rate limiting (optional)
 */

import rateLimit, { RateLimitRequestHandler, Options as RateLimitOptions } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

// Rate limit configurations
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Default rate limits for different scenarios
 */
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // Global limit - applies to all routes
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: 'Too many requests, please try again later.',
  },
  
  // Authentication routes - stricter limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 login attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
  },
  
  // API routes - moderate limits
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 API requests per 15 minutes
    message: 'API rate limit exceeded, please slow down.',
  },
  
  // Build endpoints - generous limits
  build: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 builds per hour
    message: 'Build rate limit exceeded. Please wait before creating more builds.',
  },
};

/**
 * Create a rate limiter with optional Redis store
 */
export async function createRateLimiter(
  config: RateLimitConfig = DEFAULT_LIMITS.global,
  useRedis: boolean = false
): Promise<RateLimitRequestHandler> {
  const options = {
    windowMs: config.windowMs,
    max: config.max,
    message: { error: config.message },
    standardHeaders: true,
    legacyHeaders: true,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,

    keyGenerator: (req: any) => {
      const apiKey = req.headers['x-api-key'] as string | undefined;
      if (apiKey) return `api-key:${apiKey}`;

      const userId = req.user?.id || req.headers['x-user-id'] as string | undefined;
      if (userId) return `user:${userId}`;

      return req.ip || req.socket.remoteAddress || 'unknown';
    },

    validate: { xForwardedForHeader: true },

    handler: (req: any, res: any, next: any, opts: any) => {
      const retryAfter = Math.ceil(opts.windowMs / 1000);
      res.status(429).json({
        error: opts.message,
        retryAfter,
        limit: opts.max,
        remaining: 0,
        resetTime: new Date(Date.now() + opts.windowMs).toISOString(),
      });
    },

    skip: (req: any) => {
      if (req.headers['x-internal-request'] === 'true') return true;
      if (process.env.NODE_ENV === 'test') return true;
      return false;
    },
  } as any;
  
  if (useRedis && process.env.REDIS_URL) {
    try {
      const redisClient = createClient({ url: process.env.REDIS_URL });
      await redisClient.connect();
      options.store = new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      });
      console.log('✅ Rate limiter using Redis store');
    } catch (error) {
      console.warn('⚠️ Redis connection failed, falling back to memory store:', error);
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

export function getRateLimitConfig(tier: keyof typeof DEFAULT_LIMITS): RateLimitConfig {
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
