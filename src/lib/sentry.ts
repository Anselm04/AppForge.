/**
 * Sentry Error Tracking for AppForge
 * Comprehensive error monitoring and performance tracking
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentryBackend(): void {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn('⚠️ SENTRY_DSN not configured, Sentry disabled');
    return;
  }
  
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || 'dev',
    tracesSampleRate: getTracesSampleRate(),
    integrations: [nodeProfilingIntegration()],
    profilesSampleRate: 1.0,
    
    beforeSend(event, hint) {
      if (process.env.NODE_ENV === 'development') {
        if (event.exception?.values?.[0]?.type === 'NotFoundError') {
          return null;
        }
      }
      
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers['x-api-key'];
      }
      
      return event;
    },
    
    debug: process.env.NODE_ENV === 'development',
  });
  
  console.log('✅ Sentry initialized for backend');
}

function getTracesSampleRate(): number {
  const env = process.env.NODE_ENV;
  switch (env) {
    case 'production': return parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');
    case 'staging': return parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.5');
    default: return parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0');
  }
}

export function captureException(error: Error, options?: any): string | undefined {
  if (!process.env.SENTRY_DSN) {
    console.error('Sentry not configured:', error);
    return undefined;
  }
  
  if (options?.user) Sentry.setUser(options.user);
  if (options?.tags) Object.entries(options.tags).forEach(([k, v]) => Sentry.setTag(k, v));
  if (options?.extra) Sentry.setExtra('context', options.extra);
  
  const eventId = Sentry.captureException(error, { level: options?.level || 'error' });
  console.log(`📊 Exception captured: ${eventId}`);
  return eventId;
}

export function captureMessage(message: string, options?: any): string | undefined {
  if (!process.env.SENTRY_DSN) {
    console.log('Message:', message);
    return undefined;
  }
  
  if (options?.tags) Object.entries(options.tags).forEach(([k, v]) => Sentry.setTag(k, v));
  if (options?.extra) Sentry.setExtra('context', options.extra);
  
  const eventId = Sentry.captureMessage(message, options?.level || 'info');
  console.log(`📊 Message captured: ${eventId}`);
  return eventId;
}

export function addBreadcrumb(message: string, data?: Record<string, any>): void {
  Sentry.addBreadcrumb({ message, data, level: 'info' });
}

export function setUserContext(user: { id: string; email?: string; username?: string }): void {
  Sentry.setUser(user);
}

export function clearUserContext(): void {
  Sentry.setUser(null);
}

export function startTransaction(name: string, op?: string) {
  return Sentry.startTransaction({ name, op: op || 'function' });
}

export { Sentry };
export default initSentryBackend;
