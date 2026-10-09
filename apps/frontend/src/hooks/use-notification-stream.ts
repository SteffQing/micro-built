"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NEXT_PUBLIC_API_URL } from "@/lib/axios";
import { markNotificationRead } from "@/lib/mutations/user/notifications";
import { announce } from "@/lib/notification-alerts";
import { getUser } from "@/lib/queries/user";
import { userNotifications } from "@/lib/queries/user/notifications";
import {
  emitSupportEvent,
  setNotificationStreamMounted,
  viewingConversation,
  type SupportStreamEvent,
} from "@/lib/support-events";

const STREAM_URL = `${NEXT_PUBLIC_API_URL}/user/notifications/stream`;
// Every notification query (badge, popover, page, infinite list) sits under this key.
const NOTIFICATIONS_KEY = ["/user/notifications"];
const MIN_RETRY_MS = 5_000;
const MAX_RETRY_MS = 5 * 60_000;
// The bell's badge query: always mounted, and its one item is the newest notification.
const NEWEST_KEY = userNotifications(1, 1).queryKey;

/**
 * Whether the reader is already looking at what a notification links to: the page itself, or the support
 * conversation it's about (a `?support=<id>` or `/support-inbox/<id>` link) open on screen. A hidden tab isn't looking.
 */
function isLookingAt(url?: string | null) {
  if (!url || document.visibilityState !== "visible") return false;
  const target = new URL(url, window.location.origin);
  const conversation = target.searchParams.get("support") ?? target.pathname.match(/^\/support-inbox\/([^/]+)$/)?.[1];
  if (conversation && viewingConversation() === conversation) return true;
  return target.search === "" && target.pathname === window.location.pathname;
}

/**
 * Keeps the notification queries fresh from GET /user/notifications/stream (SSE). A `notifications` event means
 * the list changed (a new one, read elsewhere, cleared), so the cached lists are refetched; a new one about the page
 * the reader is on is announced and marked read. A `support` event (a
 * support conversation changed) is handed to the open chat or inbox thread (lib/support-events).
 *
 * EventSource retries a dropped connection by itself; a refused one (401/403, or a 5xx) closes it for good, so
 * that case reopens with a backoff. Each reconnect refetches once, for anything sent while it was down.
 */
export function useNotificationStream(enabled = true) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { mutate: markRead } = useMutation(markNotificationRead);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = MIN_RETRY_MS;
    let stopped = false;
    let connectedBefore = false;
    setNotificationStreamMounted(true);

    // A notification can be about the account itself (a role change), so the account is read again with the lists.
    const newest = () => queryClient.getQueryData<ApiRes<UserNotificationsDto>>(NEWEST_KEY)?.data?.notifications[0];
    const refresh = async () => {
      // Before the badge has loaded once there is nothing to compare with, so nothing is announced.
      const loaded = queryClient.getQueryData(NEWEST_KEY) !== undefined;
      const before = newest()?.id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: getUser.queryKey, exact: true }),
      ]);
      const after = newest();
      if (!loaded || !after || after.id === before || after.isRead) return;
      announce(after, (url) => router.push(url));
      // Already on it (a reply in the inbox thread they have open): it still chimes, but lands read.
      if (isLookingAt(after.callToActionUrl)) markRead(after.id);
    };

    const open = () => {
      source = new EventSource(STREAM_URL, { withCredentials: true });
      source.onopen = () => {
        delay = MIN_RETRY_MS;
        if (connectedBefore) {
          void refresh();
          emitSupportEvent({ conversationId: "*", type: "resync" });
        }
        connectedBefore = true;
      };
      source.addEventListener("notifications", () => void refresh());
      source.addEventListener("support", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent<string>).data) as Partial<SupportStreamEvent>;
          if (typeof data.conversationId === "string" && (data.type === "message" || data.type === "status")) {
            emitSupportEvent({ conversationId: data.conversationId, type: data.type });
          }
        } catch {
          // Not an event we know.
        }
      });
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
      setNotificationStreamMounted(false);
    };
  }, [enabled, queryClient, router, markRead]);
}
