import express from "express";
import { getProjectById } from "../db.js";
import { summarizeIntegrationHealth } from "../integrations/health.js";
import { sendProjectToMarketing, type MarketingBridgeMode } from "../services/marketingBridge.js";
import { logger } from "../_core/logger.js";

export const ecosystemRouter = express.Router();

ecosystemRouter.get("/integrations", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const summary = await summarizeIntegrationHealth();
  res.setHeader("Cache-Control", "no-store");
  return res.json(summary);
});

ecosystemRouter.post("/marketing/campaigns", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const projectId = Number.parseInt(String(req.body?.projectId ?? ""), 10);
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    return res.status(400).json({ error: "A valid projectId is required" });
  }

  const project = await getProjectById(projectId);
  if (!project || project.userId !== req.user.id) {
    return res.status(404).json({ error: "Project not found" });
  }

  if (project.status !== "completed") {
    return res.status(409).json({ error: "Only completed AppForge projects can be sent to marketing" });
  }

  const requestedMode = String(req.body?.mode ?? "draft");
  const mode: MarketingBridgeMode = requestedMode === "generate" ? "generate" : "draft";
  const productUrl = typeof req.body?.productUrl === "string" ? req.body.productUrl.trim() : "";

  if (productUrl) {
    try {
      const parsed = new URL(productUrl);
      if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
        return res.status(400).json({ error: "Production product URLs must use HTTPS" });
      }
    } catch {
      return res.status(400).json({ error: "productUrl must be a valid URL" });
    }
  }

  try {
    const result = await sendProjectToMarketing({
      source: "appforge",
      sourceProjectId: project.id,
      sourceProjectCreatedAt: project.createdAt ? new Date(project.createdAt).toISOString() : null,
      sourceUserEmail: req.user.email,
      sourceUserName: req.user.name,
      productName: project.title?.trim() || `AppForge Project ${project.id}`,
      description: project.description?.trim() || "AppForge-generated product",
      techStack: project.techStack?.trim() || "unknown",
      ...(productUrl ? { productUrl } : {}),
      mode,
    });

    logger.info(
      { projectId: project.id, userId: req.user.id, mode },
      "project_sent_to_marketing",
    );

    return res.status(201).json({ success: true, result });
  } catch (error) {
    const status =
      error && typeof error === "object" && "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 502;
    logger.error(
      { error, projectId: project.id, userId: req.user.id, mode },
      "marketing_bridge_failed",
    );
    return res.status(status >= 400 && status < 500 ? status : 502).json({
      error: status === 409 ? "Marketing account required" : "Marketing service unavailable",
    });
  }
});
