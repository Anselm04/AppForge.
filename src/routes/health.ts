import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'unknown',
    version: process.env.npm_package_version ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'unknown',
  };

  try {
    // Use Drizzle's execute with raw SQL
    await db.execute(sql`SELECT 1`);
    health.database = 'connected';
  } catch (error) {
    health.status = 'degraded';
    health.database = 'disconnected';
    console.error('Health check failed: database connection failed', error);
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  // Prevent caching of health responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.status(statusCode).json(health);
});

// Liveness probe (lighter check)
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness probe (includes DB check)
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.status(200).json({ status: 'ok', ready: true });
  } catch {
    res.status(503).json({ status: 'degraded', ready: false, reason: 'database' });
  }
});

export default router;

export const healthRouter = router;
