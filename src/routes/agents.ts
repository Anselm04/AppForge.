import { Router, Request, Response } from 'express';
import AgentOrchestrator from '../services/agent-orchestrator';

const router = Router();
const orchestrator = new AgentOrchestrator();

router.post('/build', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Prompt is required.' });
    }

    const plan = await orchestrator.runBuild(prompt);
    return res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error running agent build:', error);
    return res.status(500).json({ success: false, error: 'Failed to run agent build.' });
  }
});

export default router;

export const agentsRouter = router;
