import { Router, Request, Response } from "express";
import { createHash } from "crypto";
import { mkdir, writeFile, rm, readFile, readdir, stat } from "fs/promises";
import { join, extname, relative } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";
import { getProjectById } from "../db.js";
import { verifyPreviewSignature } from "../services/deployer.js";

const livePreviewRouter = Router();

type DistCache = { hash: string; dir: string; builtAt: number };
const distCache = new Map<number, DistCache>();

export function invalidatePreviewCache(projectId: number): void {
  const cached = distCache.get(projectId);
  distCache.delete(projectId);
  if (cached?.dir) {
    void rm(cached.dir.replace(/\/dist$/, ""), {
      recursive: true,
      force: true,
    }).catch(() => {});
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".tsx": "text/plain; charset=utf-8",
  ".jsx": "text/plain; charset=utf-8",
  ".py": "text/plain; charset=utf-8",
};

function mimeFor(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
}

function normalizeFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(files)) {
    out[key.replace(/^\/+/, "")] = value;
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

function filesHash(files: Record<string, string>): string {
  const h = createHash("sha256");
  for (const key of Object.keys(files).sort()) {
    h.update(key);
    h.update("\0");
    h.update(files[key]);
    h.update("\0");
  }
  return h.digest("hex").slice(0, 16);
}

function listingPage(
  projectId: number,
  title: string,
  files: Record<string, string>,
): string {
  const items = Object.keys(files)
    .sort()
    .map(
      (name) =>
        `<li><a href="/live/${projectId}/src/${encodeURI(name)}">${escapeHtml(name)}</a></li>`,
    )
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
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>Source listing (bundled preview unavailable for this stack).</p>
  <ul>${items || "<li>No files yet.</li>"}</ul>
</body>
</html>`;
}

function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: false, env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ exitCode: 1, stdout, stderr: stderr + "\n[TIMEOUT]" });
    }, timeoutMs);
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

async function walkFiles(
  dir: string,
  base = dir,
): Promise<Record<string, Buffer>> {
  const out: Record<string, Buffer> = {};
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      Object.assign(out, await walkFiles(full, base));
    } else {
      out[relative(base, full).replace(/\\/g, "/")] = await readFile(full);
    }
  }
  return out;
}

async function buildVitePreview(
  projectId: number,
  files: Record<string, string>,
): Promise<string | null> {
  const hash = filesHash(files);
  const cached = distCache.get(projectId);
  if (cached && cached.hash === hash) {
    try {
      await stat(cached.dir);
      return cached.dir;
    } catch {
      distCache.delete(projectId);
    }
  }

  const canVite =
    !!(
      files["vite.config.ts"] ||
      files["vite.config.js"] ||
      files["index.html"]
    ) && !!files["package.json"];
  if (!canVite) return null;

  const tmpDir = join(tmpdir(), `appforge-preview-${projectId}-${hash}`);
  const outDir = join(tmpDir, "dist");
  try {
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(tmpDir, { recursive: true });
    for (const [path, content] of Object.entries(files)) {
      const full = join(tmpDir, path);
      await mkdir(join(full, ".."), { recursive: true });
      await writeFile(full, content, "utf-8");
    }

    const install = await runCmd(
      "npm",
      [
        "install",
        "--prefer-offline",
        "--no-audit",
        "--no-fund",
        "--loglevel=error",
      ],
      tmpDir,
      120_000,
    );
    if (install.exitCode !== 0) {
      console.warn("preview npm install failed", install.stderr.slice(0, 300));
      return null;
    }

    const build = await runCmd(
      "npx",
      ["vite", "build", "--outDir", "dist"],
      tmpDir,
      90_000,
    );
    if (build.exitCode !== 0) {
      console.warn("preview vite build failed", build.stderr.slice(0, 300));
      return null;
    }

    // Evict previous cache dir
    if (cached?.dir) {
      await rm(cached.dir.replace(/\/dist$/, ""), {
        recursive: true,
        force: true,
      }).catch(() => {});
    }
    distCache.set(projectId, { hash, dir: outDir, builtAt: Date.now() });
    return outDir;
  } catch (err) {
    console.warn("preview build error", err);
    return null;
  }
}

function authorizePreview(req: Request, projectId: number): boolean {
  const sig = typeof req.query.sig === "string" ? req.query.sig : undefined;
  if (verifyPreviewSignature(projectId, sig)) return true;
  if ((req as any).user) return true;
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.PREVIEW_PUBLIC === "true") return true;
  return false;
}

livePreviewRouter.use("/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (Number.isNaN(projectId)) {
      res.status(400).json({ error: "Invalid projectId" });
      return;
    }

    if (!authorizePreview(req, projectId)) {
      res
        .status(401)
        .type("html")
        .send(
          `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
        <h1>Preview requires a signed link</h1>
        <p>Use one-click <strong>Live preview</strong> deploy to get a signed URL, or sign in.</p>
        </body></html>`,
        );
      return;
    }

    const project = await getProjectById(projectId);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const files = normalizeFiles(
      (project.generatedFiles as Record<string, string> | null) ?? {},
    );
    const rel = decodeURIComponent((req.path || "/").replace(/^\//, ""));

    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader(
      "Content-Security-Policy",
      "sandbox allow-scripts allow-forms allow-modals allow-popups allow-same-origin",
    );
    res.setHeader("Cache-Control", "no-store");

    // Raw source browser
    if (rel === "files" || rel.startsWith("src/")) {
      if (rel === "files") {
        res
          .type("html")
          .send(
            listingPage(
              projectId,
              project.title || `Project ${projectId}`,
              files,
            ),
          );
        return;
      }
      const srcPath = rel.replace(/^src\//, "");
      const content = files[srcPath];
      if (content === undefined) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      res.setHeader("Content-Type", mimeFor(srcPath));
      res.send(content);
      return;
    }

    // Static HTML-only projects (no bundler)
    if (
      files["index.html"] &&
      !files["package.json"] &&
      !files["vite.config.ts"] &&
      !files["vite.config.js"]
    ) {
      if (!rel || rel === "index.html") {
        res.type("html").send(files["index.html"]);
        return;
      }
      const content = files[rel];
      if (content === undefined) {
        res.status(404).send("Not found");
        return;
      }
      res.setHeader("Content-Type", mimeFor(rel));
      res.send(content);
      return;
    }

    // Bundle Vite/React (and similar) apps
    const distDir = await buildVitePreview(projectId, files);
    if (distDir) {
      const assetPath = !rel || rel === "index.html" ? "index.html" : rel;
      try {
        const buf = await readFile(join(distDir, assetPath));
        res.setHeader("Content-Type", mimeFor(assetPath));
        res.send(buf);
        return;
      } catch {
        // fall through to listing
      }
    }

    if (files["index.html"]) {
      res.type("html").send(files["index.html"]);
      return;
    }

    res
      .type("html")
      .send(
        listingPage(projectId, project.title || `Project ${projectId}`, files),
      );
  } catch (err) {
    console.error("live preview failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Live preview unavailable" });
    }
  }
});

export { livePreviewRouter };
