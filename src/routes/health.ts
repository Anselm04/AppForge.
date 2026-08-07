import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'unknown',
    version: process.env.npm_package_version ?? 'unknown',
  };

  try {
    await db.query('SELECT 1');
    health.database = 'connected';
  } catch (error) {
    health.status = 'degraded';
    health.database = 'disconnected';
    console.error('Health check failed: database connection failed', error);
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json(health);
});

export default router;

export const healthRouter = router;
