"use client";

import { useSyncExternalStore } from "react";

// Support conversation events for signed-in users arrive on the notification stream they already hold (a `support`
// event), so an open chat or inbox thread needs no stream of its own. The notification stream feeds them in here;
// the support hooks read them. Where no notification stream runs (a visitor, or the public /support page), they open
// the conversation's own stream instead.

/** `conversationId: "*"`: the stream reconnected, so anything may have changed. */
export type SupportStreamEvent = { conversationId: string; type: "message" | "status" | "resync" };

const listeners = new Set<(event: SupportStreamEvent) => void>();
const presence = new Set<() => void>();
let streams = 0;

export function emitSupportEvent(event: SupportStreamEvent) {
  listeners.forEach((listener) => listener(event));
}

export function onSupportEvent(listener: (event: SupportStreamEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The notification stream says it is running (or no longer). */
export function setNotificationStreamMounted(mounted: boolean) {
  streams += mounted ? 1 : -1;
  presence.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  presence.add(notify);
  return () => {
    presence.delete(notify);
  };
}

// The conversation on screen (the modal's, the /support page's or an inbox thread's): a notification about it is
// already being read. The modal takes `?support=` out of the URL, so the URL can't say.
let viewing: string | null = null;

/** A thread on screen says which conversation it shows; it calls the returned function when it goes. */
export function viewConversation(id: string) {
  viewing = id;
  return () => {
    if (viewing === id) viewing = null;
  };
}

export const viewingConversation = () => viewing;

/** Whether support events reach this page over the notification stream. */
export function useNotificationStreamMounted() {
  return useSyncExternalStore(subscribe, () => streams > 0, () => false);
}
