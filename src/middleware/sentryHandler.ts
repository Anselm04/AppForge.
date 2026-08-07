/**
 * Sentry Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

export function sentryErrorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    if (status >= 500) Sentry.setHttpStatus(status);
    
    Sentry.configureScope((scope) => {
      scope.setExtra('request', {
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        body: req.body,
        headers: req.headers,
      });
      
      if (req.user) {
        scope.setUser({
          id: (req.user as any).id,
          email: (req.user as any).email,
          username: (req.user as any).username,
        });
      }
    });
    
    const eventId = Sentry.captureException(err);
    console.error(`❌ Error captured by Sentry: ${eventId}`);
    
    if (res.headersSent) return next(err);
    
    res.status(status).json({
      error: status >= 500 ? 'Internal server error' : err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack, details: err.details }),
      ...(eventId && { eventId, message: 'Error has been logged and will be investigated' }),
    });
  };
}

export function sentryRequestLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    Sentry.addBreadcrumb({
      category: 'http',
      message: `${req.method} ${req.url}`,
      data: { method: req.method, url: req.url, query: req.query },
      level: 'info',
    });
    
    const transaction = Sentry.startTransaction({ op: 'http', name: `${req.method} ${req.url}` });
    (req as any).__sentryTransaction = transaction;
    
    res.on('finish', () => {
      if ((req as any).__sentryTransaction) {
        (req as any).__sentryTransaction.setHttpStatus(res.statusCode);
        (req as any).__sentryTransaction.finish();
      }
    });
    
    next();
  };
}

export function sentryPerformance() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        Sentry.captureMessage('Slow request detected', {
          level: 'warning',
          tags: { method: req.method, url: req.url, status: res.statusCode.toString() },
          extra: { duration, threshold: 1000 },
        });
      }
    });
    
    next();
  };
}

export default sentryErrorHandler;
