import { Request, Response, NextFunction } from "express";

/** COOP/COEP headers required for WebContainer (SharedArrayBuffer) on build workspace. */
export function webContainerHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    const needsIsolation =
      req.path.startsWith("/build") ||
      req.path === "/" ||
      req.path.startsWith("/studio") ||
      req.path.startsWith("/auth/sso");
    if (!needsIsolation) return next();
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
  };
}
