"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * The record a link opens (`?loan=<id>`, `?microLoan=<id>` from a notification or the dashboard), for a modal that shows
 * it. `close()` hides the modal at once, then takes the param out of the URL (keeping any others). The modal used to
 * stay open until the URL changed, so the X did nothing whenever that replace lagged or didn't land.
 *
 * Reads `useSearchParams`: render it under a Suspense boundary.
 */
export function useLinkedParam(name: string) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get(name);
  const [closed, setClosed] = useState<string | null>(null);

  const close = useCallback(() => {
    setClosed(value);
    const rest = new URLSearchParams(params.toString());
    rest.delete(name);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [name, params, pathname, router, value]);

  // A new link (another notification) opens again, even after closing the last one.
  return { id: value && value !== closed ? value : null, close };
}
