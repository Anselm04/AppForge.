import { Router, Request, Response } from "express";
import { z } from "zod";

/**
 * Legacy stub orchestrator — redirects to the real multi-agent pipeline.
 * Do not deduct credits here; Home → projects.create → /api/build/:id is the production path.
 */
const router = Router();

const buildSchema = z.object({
  prompt: z.string().min(1).max(5000),
  techStack: z.string().max(100).optional(),
  options: z
    .object({
      timeout: z.number().int().positive().max(300000).optional(),
      maxTokens: z.number().int().positive().max(100000).optional(),
    })
    .optional(),
});

router.post("/build", async (req: Request, res: Response) => {
  const parseResult = buildSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid input",
      details: parseResult.error.issues,
    });
  }

  return res.status(410).json({
    success: false,
    error:
      "Legacy /api/agents/build is retired. Use projects.create + SSE /api/build/:projectId.",
    migration: {
      createProject: "POST /api/trpc/projects.create",
      streamBuild: "GET /api/build/:projectId (SSE)",
      techStack: parseResult.data.techStack ?? "react-node",
    },
  });
});

export default router;

export const agentsRouter = router;
