"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NEXT_PUBLIC_API_URL } from "@/lib/axios";
import { getUser } from "@/lib/queries/user";

const STREAM_URL = `${NEXT_PUBLIC_API_URL}/user/notifications/stream`;
// Every notification query (badge, popover, page, infinite list) sits under this key.
const NOTIFICATIONS_KEY = ["/user/notifications"];
const MIN_RETRY_MS = 5_000;
const MAX_RETRY_MS = 5 * 60_000;

/**
 * Keeps the notification queries fresh from GET /user/notifications/stream (SSE). A `notifications` event means
 * the list changed (a new one, read elsewhere, cleared), so the cached lists are refetched.
 *
 * EventSource retries a dropped connection by itself; a refused one (401/403, or a 5xx) closes it for good, so
 * that case reopens with a backoff. Each reconnect refetches once, for anything sent while it was down.
 */
export function useNotificationStream(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = MIN_RETRY_MS;
    let stopped = false;
    let connectedBefore = false;

    // A notification can be about the account itself (a role change), so the account is read again with the lists.
    const refresh = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: getUser.queryKey, exact: true }),
      ]);

    const open = () => {
      source = new EventSource(STREAM_URL, { withCredentials: true });
      source.onopen = () => {
        delay = MIN_RETRY_MS;
        if (connectedBefore) void refresh();
        connectedBefore = true;
      };
      source.addEventListener("notifications", () => void refresh());
      source.onerror = () => {
        if (stopped || source?.readyState !== EventSource.CLOSED) return;
        source = null;
        retryTimer = setTimeout(open, delay);
        delay = Math.min(delay * 2, MAX_RETRY_MS);
      };
    };

    open();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, [enabled, queryClient]);
}
