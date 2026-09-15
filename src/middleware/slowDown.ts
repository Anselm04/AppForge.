/**
 * Slow Down Middleware for AppForge
 * Progressive rate limiting that delays requests instead of blocking.
 */

import slowDown from "express-slow-down";
import { RateLimitRequestHandler } from "express-rate-limit";

export interface SlowDownConfig {
  windowMs: number;
  delayAfter: number;
  maxDelayMs: number;
  message: string;
}

const SLOW_DOWN_LIMITS: Record<string, SlowDownConfig> = {
  gentle: {
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    maxDelayMs: 30 * 1000,
    message: "Too many requests, responses are being delayed.",
  },
  aggressive: {
    windowMs: 5 * 60 * 1000,
    delayAfter: 10,
    maxDelayMs: 60 * 1000,
    message: "Excessive requests detected, responses are being delayed.",
  },
  api: {
    windowMs: 15 * 60 * 1000,
    delayAfter: 30,
    maxDelayMs: 15 * 1000,
    message: "API rate exceeded, responses are being delayed.",
  },
};

/** Use only server-trusted identity state for throttling buckets. */
export function slowDownIdentity(req: any): string {
  const userId = req.user?.id;
  if (userId) return `user:${userId}`;

  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createSlowDown(
  config: SlowDownConfig = SLOW_DOWN_LIMITS.gentle,
  useDelay: boolean = true,
): RateLimitRequestHandler {
  const options = {
    windowMs: config.windowMs,
    delayAfter: config.delayAfter,
    maxDelayMs: config.maxDelayMs,
    keyGenerator: slowDownIdentity,
    delayMs: (delay: number) => {
      if (!useDelay) return 0;
      return Math.min(delay, config.maxDelayMs);
    },
    // express-slow-down v2 removed the legacy `headers` option. Keep this
    // options object limited to currently supported middleware settings so a
    // dependency upgrade cannot crash AppForge during module initialization.
    skip: () => process.env.NODE_ENV === "test",
  } as any;

  return slowDown(options);
}

export const slowDownMiddleware = {
  gentle: () => createSlowDown(SLOW_DOWN_LIMITS.gentle),
  aggressive: () => createSlowDown(SLOW_DOWN_LIMITS.aggressive),
  api: () => createSlowDown(SLOW_DOWN_LIMITS.api),
};

export function createCustomSlowDown(config: Partial<SlowDownConfig>) {
  const fullConfig: SlowDownConfig = {
    ...SLOW_DOWN_LIMITS.gentle,
    ...config,
  };
  return () => createSlowDown(fullConfig);
}

export default slowDownMiddleware;
