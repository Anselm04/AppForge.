/**
 * Slow Down Middleware for AppForge
 * Progressive rate limiting that delays requests instead of blocking
 */

import slowDown from 'express-slow-down';
import { RateLimitRequestHandler } from 'express-rate-limit';

interface SlowDownConfig {
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
    message: 'Too many requests, responses are being delayed.',
  },
  aggressive: {
    windowMs: 5 * 60 * 1000,
    delayAfter: 10,
    maxDelayMs: 60 * 1000,
    message: 'Excessive requests detected, responses are being delayed.',
  },
  api: {
    windowMs: 15 * 60 * 1000,
    delayAfter: 30,
    maxDelayMs: 15 * 1000,
    message: 'API rate exceeded, responses are being delayed.',
  },
};

export function createSlowDown(
  config: SlowDownConfig = SLOW_DOWN_LIMITS.gentle,
  useDelay: boolean = true
): RateLimitRequestHandler {
  const options = {
    windowMs: config.windowMs,
    delayAfter: config.delayAfter,
    maxDelayMs: config.maxDelayMs,

    keyGenerator: (req: any) => {
      const apiKey = req.headers['x-api-key'] as string | undefined;
      if (apiKey) return `api-key:${apiKey}`;

      const userId = req.headers['x-user-id'] as string | undefined;
      if (userId) return `user:${userId}`;

      return req.ip || req.socket.remoteAddress || 'unknown';
    },

    delayMs: (delay: number) => {
      if (!useDelay) return 0;
      const progressiveDelay = Math.min(delay, config.maxDelayMs);
      console.log(`🐌 Slowing down request by ${progressiveDelay}ms`);
      return progressiveDelay;
    },

    headers: 'draft-6',

    onLimitReached: (_req: any, _res: any, _options: any) => {
      console.log(`⚠️ Slow down triggered for ${_req.method} ${_req.path}`);
    },

    skip: (req: any) => {
      if (req.headers['x-internal-request'] === 'true') return true;
      if (process.env.NODE_ENV === 'test') return true;
      return false;
    },
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
