import { Router, Request, Response } from 'express';
import { getMetrics } from '../middleware/metrics';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    cache: boolean;
    memory: boolean;
    disk: boolean;
  };
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    activeConnections: number;
  };
}

router.get('/', async (req: Request, res: Response) => {
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: true,
      cache: true,
      memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024,
      disk: true,
    },
    metrics: {
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: process.cpuUsage().user / 1000000,
      uptime: process.uptime(),
      activeConnections: 0,
    },
  };

  const isHealthy = Object.values(status.checks).every(check => check);
  status.status = isHealthy ? 'healthy' : 'degraded';

  res.status(isHealthy ? 200 : 503).json(status);
});

router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await getMetrics();
    res.setHeader('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error collecting metrics');
  }
});

router.get('/ready', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ready' });
});

router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export default router;

export const healthRouter = router;
