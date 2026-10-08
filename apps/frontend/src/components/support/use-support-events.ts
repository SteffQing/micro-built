"use client";

import { useEffect } from "react";
import { NEXT_PUBLIC_API_URL } from "@/lib/axios";
import { onSupportEvent, useNotificationStreamMounted } from "@/lib/support-events";

const MIN_RETRY_MS = 5_000;
const MAX_RETRY_MS = 5 * 60_000;

/**
 * A conversation's live events: a staff reply, a requester's message, a claim or a close. Inside the app a signed-in
 * user already holds the notification stream, which carries them as `support` events, so no second connection opens.
 * Otherwise (a visitor, the public /support page) the conversation's own stream is opened (GET
 * /support/conversations/:id/events): only while it's with the team and on screen, reconnecting with a backoff like
 * the notification stream; each reconnect calls `onEvent` once, for anything sent while it was down.
 */
export function useSupportEvents(conversationId: string | null, enabled: boolean, onEvent: () => void) {
  const overNotifications = useNotificationStreamMounted();

  useEffect(() => {
    if (!conversationId || !enabled || !overNotifications) return;
    return onSupportEvent((event) => {
      if (event.conversationId === conversationId || event.conversationId === "*") onEvent();
    });
  }, [conversationId, enabled, overNotifications, onEvent]);

  useEffect(() => {
    if (!conversationId || !enabled || overNotifications || typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = MIN_RETRY_MS;
    let stopped = false;
    let connectedBefore = false;

    const open = () => {
      source = new EventSource(`${NEXT_PUBLIC_API_URL}/support/conversations/${conversationId}/events`, {
        withCredentials: true,
      });
      source.onopen = () => {
        delay = MIN_RETRY_MS;
        if (connectedBefore) onEvent();
        connectedBefore = true;
      };
      source.addEventListener("message", onEvent);
      source.addEventListener("status", onEvent);
      source.onerror = () => {
        if (stopped || source?.readyState !== EventSource.CLOSED) return;
        source = null;
        retryTimer = setTimeout(open, delay);
        delay = Math.min(delay * 2, MAX_RETRY_MS);
      };
    };

    // Not while the tab is hidden: it reopens (and catches up) when the tab comes back.
    const onVisibility = () => {
      if (document.hidden) {
        source?.close();
        source = null;
        clearTimeout(retryTimer);
      } else if (!source) {
        open();
        onEvent();
      }
    };

    if (!document.hidden) open();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      source?.close();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [conversationId, enabled, overNotifications, onEvent]);
}
