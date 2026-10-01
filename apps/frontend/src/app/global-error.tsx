"use client";

import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  Sentry.captureException(error);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-lg bg-brand text-2xl font-bold text-brand-foreground">
            M
          </span>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We&apos;ve been notified and are looking into it. Please try
              again.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}