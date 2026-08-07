/**
 * Rate Limit Configuration
 * Centralized configuration for all rate limiting settings
 */

export interface RateLimitTier {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface SlowDownTier {
  windowMs: number;
  delayAfter: number;
  maxDelayMs: number;
  message: string;
}

export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  anonymous: {
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many requests, please try again later.',
  },
  authenticated: {
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Rate limit exceeded, please slow down.',
  },
  premium: {
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: 'Rate limit exceeded.',
  },
  enterprise: {
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Rate limit exceeded.',
  },
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true,
  },
  api: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'API rate limit exceeded.',
  },
  build: {
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Build rate limit exceeded. Please wait before creating more builds.',
  },
  upload: {
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: 'Upload rate limit exceeded.',
  },
  webhook: {
    windowMs: 60 * 1000,
    max: 100,
    message: 'Webhook rate limit exceeded.',
  },
};

export const SLOW_DOWN_TIERS: Record<string, SlowDownTier> = {
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
    delayAfter: 75,
    maxDelayMs: 15 * 1000,
    message: 'API rate exceeded, responses are being delayed.',
  },
};

export const getRateLimitConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...RATE_LIMIT_TIERS,
        anonymous: { ...RATE_LIMIT_TIERS.anonymous, max: 30 },
      };
    case 'staging':
      return {
        ...RATE_LIMIT_TIERS,
        api: { ...RATE_LIMIT_TIERS.api, max: 200 },
      };
    case 'development':
    default:
      return {
        ...RATE_LIMIT_TIERS,
        anonymous: { ...RATE_LIMIT_TIERS.anonymous, max: 1000 },
        api: { ...RATE_LIMIT_TIERS.api, max: 1000 },
      };
  }
};

export function getTierConfig(tierName: string): RateLimitTier | undefined {
  return getRateLimitConfig()[tierName];
}

export function getSlowDownConfig(tierName: string): SlowDownTier | undefined {
  return SLOW_DOWN_TIERS[tierName];
}

export default getRateLimitConfig;
