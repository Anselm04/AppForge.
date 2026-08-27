import { Router, Request, Response } from "express";
import { z } from "zod";
import { AIService } from "../services/ai-service.js";
import { AppBuilder } from "../services/app-builder.js";
import { ensureUserCredits, deductCredits } from "../db.js";
import {
  AI_GENERATE_CREDIT_COST,
  creditsExhaustedBody,
} from "../lib/credits.js";

const router = Router();
const aiService = new AIService();
const appBuilder = new AppBuilder();

// Zod schemas for AI routes
const extractSchema = z.object({
  prompt: z.string().min(1).max(5000),
});

const clarifySchema = z.object({
  requirements: z.array(z.string()).min(1).max(50),
});

const generateSchema = z.object({
  requirements: z.record(z.string(), z.any()),
  techStack: z.string().max(100).optional(),
  templateId: z.string().optional(),
});

const iterateSchema = z.object({
  appId: z.string().min(1).max(100),
  changes: z.string().min(1).max(2000),
});

const deploySchema = z.object({
  appId: z.string().min(1).max(100),
});

const exportSchema = z.object({
  appId: z.string().min(1).max(100),
  repoName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/),
});

async function requireCredits(
  req: Request,
  res: Response,
  cost: number,
  action: string,
) {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, error: "Not authenticated" });
    return null;
  }
  const credits = await ensureUserCredits(user.id);
  if (credits.balance < cost) {
    res
      .status(402)
      .json({
        success: false,
        ...creditsExhaustedBody(credits.balance, cost, action),
      });
    return null;
  }
  await deductCredits(user.id, cost, undefined, action);
  return user;
}

function validateInput(schema: z.ZodSchema, body: any) {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    };
  }
  return { valid: true, data: result.data };
}

// Extract requirements from user prompt
router.post("/extract", async (req: Request, res: Response) => {
  try {
    const validation = validateInput(extractSchema, req.body);
    if (!validation.valid) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Invalid input",
          details: validation.errors,
        });
    }
    const { prompt } = validation.data;
    const requirements = await aiService.extractRequirements(prompt);
    res.json({ success: true, data: requirements });
  } catch (error) {
    console.error("Error extracting requirements:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to extract requirements" });
  }
});

// Generate clarification questions
router.post("/clarify", async (req: Request, res: Response) => {
  try {
    const validation = validateInput(clarifySchema, req.body);
    if (!validation.valid) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Invalid input",
          details: validation.errors,
        });
    }
    const { requirements } = validation.data;
    const questions =
      await aiService.generateClarificationQuestions(requirements);
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error("Error generating questions:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to generate questions" });
  }
});

// Generate complete app — legacy stub retired
router.post("/generate", async (req: Request, res: Response) => {
  const validation = validateInput(generateSchema, req.body);
  if (!validation.valid) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Invalid input",
        details: validation.errors,
      });
  }
  return res.status(410).json({
    success: false,
    error:
      "Legacy /api/ai/generate is retired. Use projects.create + SSE /api/build/:projectId.",
    migration: {
      createProject: "POST /api/trpc/projects.create",
      streamBuild: "GET /api/build/:projectId (SSE)",
    },
  });
});

// Iterate on existing app — use Senior Dev Agent instead
router.post("/iterate", async (req: Request, res: Response) => {
  const validation = validateInput(iterateSchema, req.body);
  if (!validation.valid) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Invalid input",
        details: validation.errors,
      });
  }
  return res.status(410).json({
    success: false,
    error:
      "Legacy /api/ai/iterate is retired. Use Senior Dev Agent (projects.seniorDev + /api/build/senior/:taskId).",
  });
});

// Deploy app to Vercel
router.post("/deploy/:appId", async (req: Request, res: Response) => {
  try {
    const validation = validateInput(deploySchema, req.params);
    if (!validation.valid) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Invalid input",
          details: validation.errors,
        });
    }
    const { appId } = validation.data;
    const deployUrl = await appBuilder.deploy(appId);
    res.json({ success: true, data: { deployUrl } });
  } catch (error) {
    console.error("Error deploying app:", error);
    res.status(500).json({ success: false, error: "Failed to deploy app" });
  }
});

// Export app to GitHub
router.post("/export/:appId", async (req: Request, res: Response) => {
  try {
    const validation = validateInput(exportSchema, {
      appId: req.params.appId,
      ...req.body,
    });
    if (!validation.valid) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Invalid input",
          details: validation.errors,
        });
    }
    const { appId, repoName } = validation.data;
    const repoUrl = await appBuilder.exportToGitHub(appId, repoName);
    res.json({ success: true, data: { repoUrl } });
  } catch (error) {
    console.error("Error exporting app:", error);
    res.status(500).json({ success: false, error: "Failed to export app" });
  }
});

export default router;

export const aiRouter = router;
