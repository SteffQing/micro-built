"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/error-screen";

// The root layout itself broke, so this renders its own document. It reports to Sentry (with the error's replay) like
// every other error screen.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorScreen error={error} reset={reset} fullPage />
      </body>
    </html>
  );
}
