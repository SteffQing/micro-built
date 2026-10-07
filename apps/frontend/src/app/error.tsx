"use client";

import { ErrorScreen } from "@/components/error-screen";

// Anything that breaks under the root layout but outside the signed-in area (or in that area's layout itself).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} fullPage />;
}
