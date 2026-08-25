import * as Sentry from '@sentry/nestjs';

// Call this before requiring/importing any other modules! (see main.ts)
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
});
