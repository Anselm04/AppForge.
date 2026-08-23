import { Request, Response, NextFunction } from 'express';
import { createClient } from '../lib/redis';

const redisClient = createClient();

interface CacheOptions {
  ttl: number;
  keyPrefix?: string;
  excludeQueryParams?: boolean;
}

export function cacheMiddleware(options: CacheOptions = { ttl: 300 }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const keyPrefix = options.keyPrefix || 'cache';
    const cacheKey = options.excludeQueryParams
      ? `${keyPrefix}:${req.path}`
      : `${keyPrefix}:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cachedData));
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        redisClient.setEx(cacheKey, options.ttl, JSON.stringify(body));
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

export function invalidateCache(pattern: string) {
  return async () => {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) await redisClient.del(keys);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  };
}

export default cacheMiddleware;
