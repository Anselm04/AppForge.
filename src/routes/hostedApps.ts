import { Router, Request, Response } from "express";
import { extname } from "path";
import { getProjectById } from "../db.js";
import {
  HOSTED_MIME,
  materializeHostedHtml,
} from "../lib/hostedRuntime.js";

export const hostedAppsRouter = Router();

function mimeFor(filePath: string): string {
  return HOSTED_MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
}

function normalizeFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(files || {})) {
    if (typeof value !== "string") continue;
    out[key.replace(/^\/+/, "")] = value;
  }
  return out;
}

hostedAppsRouter.use("/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId) || projectId <= 0) {
      res.status(400).json({ error: "Invalid projectId" });
      return;
    }

    const project = await getProjectById(projectId);
    if (!project) {
      res.status(404).type("html").send(
        `<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#020617;color:#e2e8f0"><h1>App not found</h1><p>This generated app is not published yet.</p></body></html>`,
      );
      return;
    }

    const files = normalizeFiles(
      (project.generatedFiles as Record<string, string> | null) ?? {},
    );
    if (Object.keys(files).length === 0) {
      res.status(404).type("html").send(
        `<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#020617;color:#e2e8f0"><h1>Still generating</h1><p>This project has no live files yet. Wait for Generate to finish.</p></body></html>`,
      );
      return;
    }

    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader(
      "Content-Security-Policy",
      "sandbox allow-scripts allow-forms allow-modals allow-popups allow-same-origin",
    );
    res.setHeader("Cache-Control", "no-store");

    const rel = decodeURIComponent((req.path || "/").replace(/^\//, ""));
    if (!rel || rel === "index.html") {
      const html =
        files["_hosted/index.html"] ||
        materializeHostedHtml({
          projectId,
          title: project.title || `App ${projectId}`,
          description: project.description || "",
          techStack: project.techStack || "react-node",
          files,
        });
      res.type("html").send(html);
      return;
    }

    const content = files[rel] ?? files[`_hosted/${rel}`];
    if (content === undefined) {
      res.status(404).send("Not found");
      return;
    }
    res.setHeader("Content-Type", mimeFor(rel));
    res.send(content);
  } catch (err) {
    console.error("hosted app failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Live app unavailable" });
    }
  }
});
