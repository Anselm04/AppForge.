import { Request, Response, NextFunction } from 'express';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

const httpRequestsDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [registry],
});

const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

const databaseConnections = new Gauge({
  name: 'database_connections',
  help: 'Number of active database connections',
  labelNames: ['pool'],
  registers: [registry],
});

const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route'],
  registers: [registry],
});

const businessMetrics = new Counter({
  name: 'business_events_total',
  help: 'Total business events',
  labelNames: ['event'],
  registers: [registry],
});

export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    activeConnections.inc();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;
      
      httpRequestsTotal.inc({
        method: req.method,
        route,
        status: res.statusCode,
      });

      httpRequestsDuration.observe(
        { method: req.method, route },
        duration
      );

      activeConnections.dec();
    });

    next();
  };
}

export function trackError(type: string, route: string) {
  errorsTotal.inc({ type, route });
}

export function trackDatabaseQuery(operation: string, table: string, duration: number) {
  databaseQueryDuration.observe({ operation, table }, duration);
}

export function trackBusinessEvent(event: string) {
  businessMetrics.inc({ event });
}

export function updateDatabaseConnections(pool: string, count: number) {
  databaseConnections.set({ pool }, count);
}

export async function getMetrics() {
  return registry.metrics();
}

export default metricsMiddleware;
