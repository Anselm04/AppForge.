import { Router, Request, Response } from "express";
import http from "http";
import { getProjectById } from "../db.js";
import { getSandboxDevPort } from "../services/projectSandbox.js";

/** Reverse-proxy sandbox Vite dev server for live preview (HTTP; WS upgrade optional). */
export const sandboxDevProxyRouter = Router();

function readScopedPreviewUserId(
  req: Request,
  projectId: number,
): number | null {
  const value = req.signedCookies?.[`appforge-preview-${projectId}`];
  if (typeof value !== "string") return null;
  const userId = Number.parseInt(value, 10);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

async function authorize(
  req: Request,
  res: Response,
): Promise<{ projectId: number; userId: number; port: number } | null> {
  const projectId = parseInt(String(req.params.projectId), 10);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const requestUserId = (req as Request & { user?: { id: number } }).user?.id;
  const userId = requestUserId ?? readScopedPreviewUserId(req, projectId);
  if (!userId) {
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

function sandboxRequestHeaders(
  req: Request,
  port: number,
): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = { ...req.headers };

  // Never expose AppForge credentials/session material to customer-generated
  // dev servers. Authorization already happened at the proxy boundary.
  delete headers.authorization;
  delete headers.cookie;
  delete headers["x-api-key"];
  delete headers["x-csrf-token"];
  delete headers["x-xsrf-token"];
  delete headers["stripe-signature"];
  headers.host = `127.0.0.1:${port}`;
  return headers;
}

function sandboxResponseHeaders(
  source: http.IncomingHttpHeaders,
): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = { ...source };

  // A generated app must never be able to plant cookies on the AppForge origin.
  delete headers["set-cookie"];
  headers["content-security-policy"] =
    "sandbox allow-scripts allow-forms allow-modals allow-popups";
  headers["referrer-policy"] = "no-referrer";
  headers["x-robots-tag"] = "noindex";
  headers["cache-control"] = "no-store";
  return headers;
}

async function proxySandboxRequest(req: Request, res: Response): Promise<void> {
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
      headers: sandboxRequestHeaders(req, auth.port),
    },
    (proxyRes) => {
      res.writeHead(
        proxyRes.statusCode ?? 502,
        sandboxResponseHeaders(proxyRes.headers),
      );
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    if (!res.headersSent) res.status(502).send("Dev server unreachable");
  });
  req.pipe(proxyReq);
}

sandboxDevProxyRouter.all("/:projectId", proxySandboxRequest);
sandboxDevProxyRouter.all("/:projectId/*", proxySandboxRequest);
