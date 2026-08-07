import { Request, Response, NextFunction } from 'express';

interface PerformanceMetrics {
  route: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: string;
}

const slowQueryThreshold = 100;
const metrics: PerformanceMetrics[] = [];

export function performanceMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const route = req.route?.path || req.path;
      
      metrics.push({
        route,
        method: req.method,
        duration,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
      });

      if (metrics.length > 1000) metrics.shift();

      if (duration > slowQueryThreshold) {
        console.warn(`[PERFORMANCE] Slow request: ${req.method} ${route} took ${duration}ms`);
      }
    });

    next();
  };
}

export function getPerformanceMetrics() { return metrics; }
export function getSlowRoutes(limit = 10) {
  return metrics.sort((a, b) => b.duration - a.duration).slice(0, limit);
}
export function getAverageResponseTime() {
  if (metrics.length === 0) return 0;
  const total = metrics.reduce((sum, m) => sum + m.duration, 0);
  return Math.round(total / metrics.length);
}

export default performanceMiddleware;
