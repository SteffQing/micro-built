import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  // Replay keeps its default masking of all text/inputs/media.
  integrations: [
    Sentry.replayIntegration(),
    // "Report a problem" in the avatar menu opens this form; it loads on first use, with no floating button.
    Sentry.feedbackAsyncIntegration({
      autoInject: false,
      colorScheme: "system",
      showBranding: false,
      showName: false,
      showEmail: false,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;