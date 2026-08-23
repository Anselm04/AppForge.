/**
 * Content Security Policy (CSP)
 * Prevents XSS and injection attacks
 */

import { Request, Response, NextFunction } from 'express';

export function generateCSPDirectives(): Record<string, string | string[]> {
  const isDev = process.env.NODE_ENV === 'development';
  
  const directives: Record<string, string | string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  
  if (isDev) {
    directives['script-src'] = ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
    directives['connect-src'] = ["'self'", 'ws:', 'wss:'];
  }
  
  return directives;
}

export function contentSecurityPolicy() {
  return (req: Request, res: Response, next: NextFunction) => {
    const directives = generateCSPDirectives();
    const cspString = Object.entries(directives)
      .map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(' ') : value}`)
      .join('; ');
    
    res.setHeader('Content-Security-Policy', cspString);
    next();
  };
}

export function generateNonce(): string {
  return `nonce-${Buffer.from(crypto.randomUUID()).toString('base64')}`;
}

export default contentSecurityPolicy;
