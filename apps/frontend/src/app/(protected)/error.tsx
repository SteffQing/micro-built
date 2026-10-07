"use client";

import { ErrorScreen } from "@/components/error-screen";

// A page in the signed-in area broke: the sidebar and header stay, so the user can go elsewhere.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
