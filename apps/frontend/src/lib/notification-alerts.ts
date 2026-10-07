"use client";

import { useSyncExternalStore } from "react";

/**
 * How this browser announces a new notification: a chime, and a system pop-up while the app is in the background.
 * Both are per-device choices, so they live in localStorage (wrapped: it can be missing or throw).
 */
export type AlertPrefs = { sound: boolean; popups: boolean };

const PREFS_KEY = "mb:notification-alerts";
const LAST_ALERTED_KEY = "mb:notification-last-alerted";
const DEFAULTS: AlertPrefs = { sound: true, popups: false };

const listeners = new Set<() => void>();
let cached: AlertPrefs | null = null;

function read(): AlertPrefs {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    cached = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AlertPrefs>) } : DEFAULTS;
  } catch {
    cached = DEFAULTS;
  }
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed them.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PREFS_KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getAlertPrefs(): AlertPrefs {
  return typeof window === "undefined" ? DEFAULTS : read();
}

export function setAlertPrefs(patch: Partial<AlertPrefs>) {
  cached = { ...read(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(cached));
  } catch {
    // Kept for this tab only.
  }
  if (cached.sound) primeAudio();
  listeners.forEach((listener) => listener());
}

export function useAlertPrefs(): AlertPrefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}

// ---- Sound ----

let audio: AudioContext | null = null;

/**
 * Browsers only let a page play sound after the user has interacted with it, and a context created in a background
 * tab starts suspended. So the context is made (or resumed) on the first click or key press, ready for later.
 */
function primeAudio() {
  if (typeof window === "undefined") return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

if (typeof window !== "undefined") {
  const onGesture = () => {
    if (!getAlertPrefs().sound) return;
    primeAudio();
    if (audio?.state === "running") {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    }
  };
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);
}

/** A short two-note chime, made with Web Audio so there is no file to load. */
export function playChime() {
  primeAudio();
  if (!audio || audio.state !== "running") return;
  const start = audio.currentTime;
  [
    { freq: 880, at: 0 },
    { freq: 1318.5, at: 0.12 },
  ].forEach(({ freq, at }) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start + at);
    gain.gain.exponentialRampToValueAtTime(0.18, start + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.45);
    osc.connect(gain).connect(audio!.destination);
    osc.start(start + at);
    osc.stop(start + at + 0.5);
  });
}

// ---- Pop-ups ----

export type PopupPermission = NotificationPermission | "unsupported";

export function popupPermission(): PopupPermission {
  return typeof window === "undefined" || !("Notification" in window) ? "unsupported" : Notification.permission;
}

/** Turns pop-ups on, asking the browser first. Returns the permission it ended with. */
export async function enablePopups(): Promise<PopupPermission> {
  if (popupPermission() === "unsupported") return "unsupported";
  const permission =
    Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  setAlertPrefs({ popups: permission === "granted" });
  return permission;
}

// ---- Announcing ----

/**
 * Every open tab hears the same stream event; the first to claim a notification announces it, so several tabs don't
 * chime together.
 */
function claim(id: string): boolean {
  try {
    if (localStorage.getItem(LAST_ALERTED_KEY) === id) return false;
    localStorage.setItem(LAST_ALERTED_KEY, id);
  } catch {
    // No storage: this tab announces it.
  }
  return true;
}

/** Chimes and, while the app is in the background, shows a system pop-up that opens the notification's link. */
export function announce(notification: UserNotificationDto, open: (url: string) => void) {
  const prefs = getAlertPrefs();
  if (!prefs.sound && !prefs.popups) return;
  if (!claim(notification.id)) return;

  if (prefs.sound) playChime();

  const away = document.visibilityState === "hidden" || !document.hasFocus();
  if (prefs.popups && away && popupPermission() === "granted") {
    try {
      const popup = new Notification(notification.title, {
        body: notification.description,
        icon: "/apple-icon.png",
        tag: notification.id,
      });
      popup.onclick = () => {
        window.focus();
        open(notification.callToActionUrl || "/notifications");
        popup.close();
      };
    } catch {
      // Some mobile browsers only show notifications from a service worker; the chime and badge still tell.
    }
  }
}
