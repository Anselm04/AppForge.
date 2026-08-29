import { Router, Request, Response } from "express";
import http from "http";
import { getProjectById } from "../db.js";
import { getSandboxDevPort } from "../services/projectSandbox.js";

/** Reverse-proxy sandbox Vite dev server for live preview (HTTP; WS upgrade optional). */
export const sandboxDevProxyRouter = Router();

async function authorize(
  req: Request,
  res: Response,
): Promise<{ projectId: number; userId: number; port: number } | null> {
  const projectId = parseInt(String(req.params.projectId), 10);
  const userId = (req as Request & { user?: { id: number } }).user?.id;
  if (!userId || !Number.isFinite(projectId)) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const project = await getProjectById(projectId);
  if (!project || project.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  const port = getSandboxDevPort(projectId, userId);
  if (!port) {
    res
      .status(503)
      .send(
        "Sandbox dev server not running. Run npm run dev in the Terminal tab.",
      );
    return null;
  }
  return { projectId, userId, port };
}

sandboxDevProxyRouter.all(
  "/:projectId",
  async (req: Request, res: Response) => {
    const auth = await authorize(req, res);
    if (!auth) return;
    const suffix =
      req.originalUrl.replace(
        new RegExp(`^/sandbox-dev/${auth.projectId}`),
        "",
      ) || "/";
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: auth.port,
        path: suffix,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${auth.port}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on("error", () => {
      if (!res.headersSent) res.status(502).send("Dev server unreachable");
    });
    req.pipe(proxyReq);
  },
);

sandboxDevProxyRouter.all(
  "/:projectId/*",
  async (req: Request, res: Response) => {
    const auth = await authorize(req, res);
    if (!auth) return;
    const suffix =
      req.originalUrl.replace(
        new RegExp(`^/sandbox-dev/${auth.projectId}`),
        "",
      ) || "/";
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: auth.port,
        path: suffix,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${auth.port}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on("error", () => {
      if (!res.headersSent) res.status(502).send("Dev server unreachable");
    });
    req.pipe(proxyReq);
  },
);
