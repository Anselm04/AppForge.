import { Router, Request, Response } from "express";
import { z } from "zod";
import { AIService } from "../services/ai-service.js";
import { logger } from "../_core/logger.js";

const router = Router();
const aiService = new AIService();

const extractSchema = z.object({
  prompt: z.string().min(1).max(5000),
});

const clarifySchema = z.object({
  requirements: z.array(z.string().min(1).max(1000)).min(1).max(50),
});

const generateSchema = z.object({
  requirements: z.record(z.string(), z.any()),
  techStack: z.string().max(100).optional(),
  templateId: z.string().max(100).optional(),
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

function requireAuthenticatedUser(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Not authenticated" });
    return false;
  }
  return true;
}

function validateInput(schema: z.ZodSchema, body: any) {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      valid: false as const,
      errors: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    };
  }
  return { valid: true as const, data: result.data };
}

router.post("/extract", async (req: Request, res: Response) => {
  if (!requireAuthenticatedUser(req, res)) return;

  try {
    const validation = validateInput(extractSchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        details: validation.errors,
      });
    }
    const { prompt } = validation.data;
    const requirements = await aiService.extractRequirements(prompt);
    res.json({ success: true, data: requirements });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, "ai_extract_requirements_failed");
    res
      .status(500)
      .json({ success: false, error: "Failed to extract requirements" });
  }
});

router.post("/clarify", async (req: Request, res: Response) => {
  if (!requireAuthenticatedUser(req, res)) return;

  try {
    const validation = validateInput(clarifySchema, req.body);
    if (!validation.valid) {
      return res.status(400).json({
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
    logger.error(
      { error, userId: req.user?.id },
      "ai_clarification_questions_failed",
    );
    res
      .status(500)
      .json({ success: false, error: "Failed to generate questions" });
  }
});

router.post("/generate", (req: Request, res: Response) => {
  if (!requireAuthenticatedUser(req, res)) return;
  const validation = validateInput(generateSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({
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

router.post("/iterate", (req: Request, res: Response) => {
  if (!requireAuthenticatedUser(req, res)) return;
  const validation = validateInput(iterateSchema, req.body);
  if (!validation.valid) {
    return res.status(400).json({
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

router.post("/deploy/:appId", (req: Request, res: Response) => {
  if (!requireAuthenticatedUser(req, res)) return;
  const validation = validateInput(deploySchema, req.params);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: "Invalid input",
      details: validation.errors,
    });
  }
  return res.status(410).json({
    success: false,
    error:
      "Legacy /api/ai/deploy is retired. Use the authenticated projects.deploy workflow.",
  });
});

router.post("/export/:appId", (req: Request, res: Response) => {
  if (!requireAuthenticatedUser(req, res)) return;
  const validation = validateInput(exportSchema, {
    appId: req.params.appId,
    ...req.body,
  });
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: "Invalid input",
      details: validation.errors,
    });
  }
  return res.status(410).json({
    success: false,
    error:
      "Legacy /api/ai/export is retired. Use the authenticated GitHub project export workflow.",
  });
});

export default router;

export const aiRouter = router;
