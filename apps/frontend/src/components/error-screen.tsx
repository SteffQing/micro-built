"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { HomeButton, ReportButton, StatusScreen } from "@/components/status-screen";

/**
 * What an error boundary shows (error.tsx, global-error.tsx). It reports the error to Sentry once, which also sends the
 * session replay Sentry keeps for errors, and shows Sentry's event id so support can find that report.
 */
export function ErrorScreen({
  error,
  reset,
  fullPage = false,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  fullPage?: boolean;
}) {
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    const id = Sentry.captureException(error);
    // Recording which event this screen stands for; Sentry runs outside React, so this is a sync from it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEventId(id);
  }, [error]);

  return (
    <StatusScreen
      tone="error"
      code="500"
      title="Something went wrong"
      description="We've been told about it and will look into it. Trying again usually helps."
      reference={eventId ?? error.digest ?? null}
      fullPage={fullPage}
      actions={
        <>
          {reset && (
            <Button onClick={reset}>
              <Icon icon={icons.refresh} size={16} />
              Try again
            </Button>
          )}
          <HomeButton variant="outline" />
          <ReportButton />
        </>
      }
    />
  );
}
