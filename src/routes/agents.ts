import { Router, Request, Response } from 'express';
import { z } from 'zod';
import AgentOrchestrator from '../services/agent-orchestrator.js';
import { ensureUserCredits, deductCredits } from '../db.js';
import { BUILD_CREDIT_COST, creditsExhaustedBody } from '../lib/credits.js';

const router = Router();
const orchestrator = new AgentOrchestrator();

const buildSchema = z.object({
  prompt: z.string().min(1).max(5000),
  techStack: z.string().max(100).optional(),
  options: z.object({
    timeout: z.number().int().positive().max(300000).optional(),
    maxTokens: z.number().int().positive().max(100000).optional(),
  }).optional(),
});

router.post('/build', async (req: Request, res: Response) => {
  try {
    const parseResult = buildSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: parseResult.error.issues,
      });
    }

    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const credits = await ensureUserCredits(user.id);
    if (credits.balance < BUILD_CREDIT_COST) {
      return res.status(402).json({ success: false, ...creditsExhaustedBody(credits.balance, BUILD_CREDIT_COST, 'start an agent build') });
    }
    await deductCredits(user.id, BUILD_CREDIT_COST, undefined, 'Agent build');

    const { prompt } = parseResult.data;
    const plan = await orchestrator.runBuild(prompt);
    return res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error running agent build:', error);
    return res.status(500).json({ success: false, error: 'Failed to run agent build.' });
  }
});

export default router;

export const agentsRouter = router;
