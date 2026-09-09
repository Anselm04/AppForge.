import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { summarizeTeamIntegrations } from '../config/teamIntegrations.js';

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
    await db.execute(sql`SELECT 1`);
    health.database = 'connected';
  } catch (error) {
    health.status = 'degraded';
    health.database = 'disconnected';
    console.error('Health check failed: database connection failed', error);
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.status(statusCode).json(health);
});

router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/ready', async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.status(200).json({ status: 'ok', ready: true });
  } catch {
    res.status(503).json({ status: 'degraded', ready: false, reason: 'database' });
  }
});

// Configuration-only readiness for the locked TrillionAi 13-team architecture.
// This endpoint never returns credentials, tokens, IDs, or URLs; it only reports
// whether each integration has the minimum expected configuration present.
router.get('/integrations', (_req: Request, res: Response) => {
  const summary = summarizeTeamIntegrations();
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  );
  return res.status(200).json({
    status: summary.productionReady ? 'configured' : 'incomplete',
    configured: summary.configured,
    required: summary.required,
    productionReady: summary.productionReady,
    integrations: summary.integrations,
  });
});


export default router;

export const healthRouter = router;
