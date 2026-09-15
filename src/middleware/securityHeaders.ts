/**
 * Security Headers Middleware
 * Enhanced Helmet.js configuration for AppForge
 */

import helmet from "helmet";
import { Request, Response, NextFunction } from "express";

export function shouldPreventCaching(path: string): boolean {
  return path.startsWith("/api/") || path === "/api" || path.startsWith("/auth/") || path === "/auth";
}

export function additionalSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (shouldPreventCaching(req.path)) {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }

    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.removeHeader("X-Powered-By");
    res.removeHeader("Server");

    next();
  };
}

export function securityHeaders() {
  const isDev = process.env.NODE_ENV === "development";
  const helmetMiddleware = helmet({
    contentSecurityPolicy: false, // Configured separately
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    hidePoweredBy: true,
    // AppForge embeds its own /sandbox-dev preview in an iframe. SAMEORIGIN
    // preserves clickjacking protection while allowing that trusted preview.
    frameguard: { action: "sameorigin" },
    hsts: isDev
      ? false
      : { maxAge: 31536000, includeSubDomains: true, preload: true },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  });
  const extraHeaders = additionalSecurityHeaders();

  // Compose both layers into the single middleware mounted by server.ts. This
  // prevents sensitive API/auth responses from being cached even if an
  // individual route forgets to set Cache-Control itself.
  return (req: Request, res: Response, next: NextFunction) => {
    helmetMiddleware(req, res, (error?: unknown) => {
      if (error) return next(error);
      return extraHeaders(req, res, next);
    });
  };
}

export function securityMiddleware() {
  return [securityHeaders()];
}

export default securityHeaders;
