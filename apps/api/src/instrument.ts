import * as Sentry from '@sentry/nestjs';

// Call this before requiring/importing any other modules! (see main.ts)
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  beforeSend(event) {
    // Drop intentional test events (e.g. integration setup verification)
    const message = event.message ?? event.exception?.values?.[0]?.value ?? '';
    if (/integration test/i.test(message)) {
      return null;
    }
    return event;
  },
});
