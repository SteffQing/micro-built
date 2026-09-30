// Imported first by main.ts so Sentry can instrument every module loaded after it. It also
// loads apps/backend/.env for local runs; hosted environments set real variables, which win.
import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.RAILWAY_GIT_COMMIT_SHA,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  // No PII (D9). SDK 11 collects bodies, cookies, headers, query params and user details by
  // default; bodies here carry names, phone numbers, BVNs, account numbers and passwords. The
  // only user detail sent is the id, set explicitly by the AccessGuard.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: { allow: ['user-agent', 'content-type', 'content-length'] }, response: false },
    httpBodies: [],
    urlQueryParams: false,
  },
});
