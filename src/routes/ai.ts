import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai-service';
import { AppBuilder } from '../services/app-builder';

const router = Router();
const aiService = new AIService();
const appBuilder = new AppBuilder();

// Extract requirements from user prompt
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    const requirements = await aiService.extractRequirements(prompt);
    res.json({ success: true, data: requirements });
  } catch (error) {
    console.error('Error extracting requirements:', error);
    res.status(500).json({ success: false, error: 'Failed to extract requirements' });
  }
});

// Generate clarification questions
router.post('/clarify', async (req: Request, res: Response) => {
  try {
    const { requirements } = req.body;
    const questions = await aiService.generateClarificationQuestions(requirements);
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({ success: false, error: 'Failed to generate questions' });
  }
});

// Generate complete app
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { requirements } = req.body;
    const app = await appBuilder.build(requirements);
    res.json({ success: true, data: app });
  } catch (error) {
    console.error('Error generating app:', error);
    res.status(500).json({ success: false, error: 'Failed to generate app' });
  }
});

// Iterate on existing app
router.post('/iterate', async (req: Request, res: Response) => {
  try {
    const { appId, changes } = req.body;
    const app = await appBuilder.iterate(appId, changes);
    res.json({ success: true, data: app });
  } catch (error) {
    console.error('Error iterating app:', error);
    res.status(500).json({ success: false, error: 'Failed to iterate app' });
  }
});

// Deploy app to Vercel
router.post('/deploy/:appId', async (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const deployUrl = await appBuilder.deploy(appId);
    res.json({ success: true, data: { deployUrl } });
  } catch (error) {
    console.error('Error deploying app:', error);
    res.status(500).json({ success: false, error: 'Failed to deploy app' });
  }
});

// Export app to GitHub
router.post('/export/:appId', async (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const { repoName } = req.body;
    const repoUrl = await appBuilder.exportToGitHub(appId, repoName);
    res.json({ success: true, data: { repoUrl } });
  } catch (error) {
    console.error('Error exporting app:', error);
    res.status(500).json({ success: false, error: 'Failed to export app' });
  }
});

export default router;

export const aiRouter = router;
