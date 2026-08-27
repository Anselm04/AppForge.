import { Router, Request, Response } from "express";
import { getProjectById } from "../db.js";

const livePreviewRouter = Router();

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".tsx": "text/plain; charset=utf-8",
  ".jsx": "text/plain; charset=utf-8",
  ".py": "text/plain; charset=utf-8",
};

function mimeFor(filePath: string): string {
  const lower = filePath.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  return MIME[ext] || "text/plain; charset=utf-8";
}

function normalizeFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(files)) {
    out[key.replace(/^\/+/ , "")] = value;
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listingPage(projectId: number, title: string, files: Record<string, string>): string {
  const items = Object.keys(files)
    .sort()
    .map((name) => `<li><a href="/live/${projectId}/${encodeURI(name)}">${escapeHtml(name)}</a></li>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — AppForge live</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; background: #0f172a; color: #e2e8f0; }
    a { color: #93c5fd; }
    code { font-size: 13px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>Generated files hosted on Fly. This is the live artifact for this build.</p>
  <ul>
    ${items || "<li>No files yet.</li>"}
  </ul>
</body>
</html>`;
}

livePreviewRouter.use("/:projectId", async (req: Request, res: Response) => {
  try {
  const projectId = parseInt(req.params.projectId, 10);
  if (Number.isNaN(projectId)) {
    res.status(400).json({ error: "Invalid projectId" });
    return;
  }

  const project = await getProjectById(projectId);
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const files = normalizeFiles((project.generatedFiles as Record<string, string> | null) ?? {});
  const rel = decodeURIComponent((req.path || "/").replace(/^\//, ""));

  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Content-Security-Policy", "sandbox allow-scripts allow-forms allow-modals allow-popups");
  res.setHeader("Cache-Control", "no-store");

  if (!rel || rel === "index.html") {
    if (files["index.html"]) {
      res.type("html").send(files["index.html"]);
      return;
    }
    res.type("html").send(listingPage(projectId, project.title || `Project ${projectId}`, files));
    return;
  }

  const content = files[rel];
  if (content === undefined) {
    res.status(404).type("html").send(listingPage(projectId, project.title || `Project ${projectId}`, files));
    return;
  }

  res.setHeader("Content-Type", mimeFor(rel));
  res.send(content);
  } catch (err) {
    console.error("live preview failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Live preview unavailable" });
    }
  }
});

export { livePreviewRouter };
