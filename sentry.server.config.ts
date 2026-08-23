/**
 * Sentry Configuration for Backend
 * Import at server entry: import './sentry.server.config';
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || 'dev',
    integrations: [nodeProfilingIntegration(), Sentry.httpIntegration(), Sentry.expressIntegration()],
    tracesSampleRate: getTracesSampleRate(),
    profilesSampleRate: 1.0,
    
    beforeSend(event, hint) {
      if (process.env.NODE_ENV === 'development') {
        if (event.exception?.values?.[0]?.type === 'NotFoundError') return null;
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

export { Sentry };
