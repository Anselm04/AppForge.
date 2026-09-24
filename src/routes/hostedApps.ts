import { Router, Request, Response } from "express";
import { extname } from "path";
import { getCurrentArtifact, getProjectById } from "../db.js";
import { HOSTED_MIME } from "../lib/hostedRuntime.js";
import { parsePositiveIntParam } from "../lib/httpParams.js";
import { injectVisualPreviewBridge } from "../lib/visualPreviewBridge.js";
import { getStackAdapter } from "../lib/stackAdapters.js";
import { validateProductContract } from "../lib/productContract.js";
import { ensureIsolatedPreview } from "../services/previewRuntime.js";
import { resolveProjectStack } from "../lib/projectStack.js";

export const hostedAppsRouter = Router();

function mimeFor(filePath: string): string {
  return (
    HOSTED_MIME[extname(filePath).toLowerCase()] || "application/octet-stream"
  );
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
    const projectId = parsePositiveIntParam(req.params.projectId);
    if (projectId === null) {
      res.status(400).json({ error: "Invalid projectId" });
      return;
    }

    const project = await getProjectById(projectId);
    if (!project) {
      res
        .status(404)
        .type("html")
        .send(
          `<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#020617;color:#e2e8f0"><h1>App not found</h1><p>This generated app is not published yet.</p></body></html>`,
        );
      return;
    }

    const artifact = await getCurrentArtifact(projectId);
    if (!artifact) {
      res
        .status(409)
        .type("html")
        .send(
          `<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#020617;color:#e2e8f0"><h1>No validated release</h1><p>Working or partial build files are never served as the hosted product.</p></body></html>`,
        );
      return;
    }
    const files = normalizeFiles(artifact.files);
    const contract = project.productContract
      ? validateProductContract(project.productContract)
      : null;
    const stackAdapter = getStackAdapter(
      resolveProjectStack({
        techStack: project.techStack,
        productContract: contract,
      }).techStack,
    );
    res.setHeader("X-AppForge-Snapshot-Id", String(artifact.snapshotId));
    res.setHeader("X-AppForge-Artifact-Version", String(artifact.version));
    res.setHeader("X-AppForge-Artifact-Sha256", artifact.integrity.sha256);
    if (Object.keys(files).length === 0) {
      res
        .status(404)
        .type("html")
        .send(
          `<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#020617;color:#e2e8f0"><h1>Still generating</h1><p>This project has no live files yet. Wait for Generate to finish.</p></body></html>`,
        );
      return;
    }

    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader(
      "Content-Security-Policy",
      // Generated code is untrusted. Do NOT grant allow-same-origin here: doing
      // so together with allow-scripts would let a generated app run with the
      // AppForge origin and call authenticated /api routes using the viewer's
      // cookies. Keeping the sandbox on an opaque origin isolates customer apps
      // while still allowing scripts/forms/modals/popups inside the preview.
      "sandbox allow-scripts allow-forms allow-modals allow-popups",
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");

    const rel = decodeURIComponent((req.path || "/").replace(/^\//, ""));

    if (stackAdapter.generationMode === "structural") {
      res
        .status(409)
        .type("html")
        .send(
          '<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#020617;color:#e2e8f0"><h1>Structural output</h1><p>' +
            stackAdapter.label +
            " requires native " +
            stackAdapter.runtime +
            " runtime verification before AppForge can present it as a runnable product.</p><p>Snapshot " +
            artifact.version +
            " is preserved; no substitute AppForge shell is being shown.</p></body></html>",
        );
      return;
    }

    const staticHtmlProject =
      stackAdapter.previewMode === "static" &&
      !!files["index.html"] &&
      !files["package.json"];

    if (staticHtmlProject) {
      if (!rel || rel === "index.html") {
        const visualMode = req.query.appforgeVisual === "1";
        const html = files["index.html"];
        res
          .type("html")
          .send(visualMode ? injectVisualPreviewBridge(html) : html);
        return;
      }
      const content = files[rel];
      if (content !== undefined) {
        res.setHeader("Content-Type", mimeFor(rel));
        res.send(content);
        return;
      }
      const looksLikeClientRoute =
        !rel.includes(".") || req.accepts(["html", "json"]) === "html";
      if (looksLikeClientRoute) {
        res.type("html").send(files["index.html"]);
        return;
      }
      res.status(404).send("Not found");
      return;
    }

    const runtimeUrl = await ensureIsolatedPreview({
      projectId,
      artifact,
      stack: stackAdapter,
    });
    if (!runtimeUrl) {
      res
        .status(503)
        .type("html")
        .send(
          '<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#020617;color:#e2e8f0"><h1>Runtime preview unavailable</h1><p>The real ' +
            stackAdapter.label +
            " artifact is preserved, but the isolated preview runtime is not configured.</p><p>AppForge will not replace it with a generic shell or pretend that source-only output is the generated product.</p></body></html>",
        );
      return;
    }
    const target = new URL(runtimeUrl);
    const basePath = target.pathname.replace(/\/$/, "");
    target.pathname = (basePath + "/" + rel).replace(/\/+/g, "/");
    target.search = "";
    target.hash = "";
    res.redirect(307, target.toString());
    return;
  } catch (err) {
    console.error("hosted app failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Live app unavailable" });
    }
  }
});
