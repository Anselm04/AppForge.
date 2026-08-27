/**
 * Security Headers Middleware
 * Enhanced Helmet.js configuration for AppForge
 */

import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

export function securityHeaders() {
  const isDev = process.env.NODE_ENV === 'development';
  
  return helmet({
    contentSecurityPolicy: false, // Configured separately
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    hidePoweredBy: true,
    frameguard: { action: 'deny' },
    hsts: isDev ? false : { maxAge: 31536000, includeSubDomains: true, preload: true },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
}

export function additionalSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    next();
  };
}

export function securityMiddleware() {
  return [securityHeaders(), additionalSecurityHeaders()];
}

export default securityHeaders;
