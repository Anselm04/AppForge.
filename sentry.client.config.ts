/**
 * Sentry Configuration for Frontend
 * Import in src/main.tsx: import '../sentry.client.config';
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    release: import.meta.env.npm_package_version || 'dev',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: getTracesSampleRate(),
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    beforeSend(event, hint) {
      if (import.meta.env.MODE === 'development') {
        if (event.exception?.values?.[0]?.type === 'NotFoundError') return null;
      }
      
      const ignoreErrors = ['ResizeObserver loop limit exceeded', 'Non-Error exception captured', 'Network request failed'];
      if (event.exception?.values?.[0]?.value && ignoreErrors.some(msg => event.exception?.values?.[0].value?.includes(msg))) {
        return null;
      }
      
      return event;
    },
    
    debug: import.meta.env.MODE === 'development',
  });
  
  console.log('✅ Sentry initialized for frontend');
}

function getTracesSampleRate(): number {
  const mode = import.meta.env.MODE;
  switch (mode) {
    case 'production': return parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1');
    case 'staging': return parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.5');
    default: return parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '1.0');
  }
}

export { Sentry };
