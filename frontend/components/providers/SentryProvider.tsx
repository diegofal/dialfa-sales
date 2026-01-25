'use client';

import * as Sentry from '@sentry/react';
import { useEffect } from 'react';

let initialized = false;

export function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (initialized) return;

    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (!dsn) {
      return;
    }

    Sentry.init({
      dsn,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      environment: process.env.NODE_ENV || 'development',
      beforeSend(event) {
        // Only send errors in production
        if (process.env.NODE_ENV === 'development') {
          return null;
        }
        return event;
      },
    });

    initialized = true;
  }, []);

  return <>{children}</>;
}
