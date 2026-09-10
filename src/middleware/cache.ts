import { Request, Response, NextFunction } from "express";
import { createClient } from "../lib/redis";
import { logger } from "../_core/logger.js";

const redisClient = createClient();

interface CacheOptions {
  ttl: number;
  keyPrefix?: string;
  excludeQueryParams?: boolean;
}

export function cacheMiddleware(options: CacheOptions = { ttl: 300 }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();

    const keyPrefix = options.keyPrefix || "cache";
    const cacheKey = options.excludeQueryParams
      ? `${keyPrefix}:${req.path}`
      : `${keyPrefix}:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        res.setHeader("X-Cache", "HIT");
        return res.json(JSON.parse(cachedData));
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        void redisClient
          .setEx(cacheKey, options.ttl, JSON.stringify(body))
          .catch((error) =>
            logger.error({ error }, "cache_write_failed"),
          );
        res.setHeader("X-Cache", "MISS");
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error({ error }, "cache_middleware_failed");
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
      logger.error({ error }, "cache_invalidation_failed");
    }
  };
}

export default cacheMiddleware;
