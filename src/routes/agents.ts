import { Router, Request, Response } from 'express';
import { z } from 'zod';
import AgentOrchestrator from '../services/agent-orchestrator.js';

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
