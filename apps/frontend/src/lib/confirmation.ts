// Gated admin actions (disbursements, vouchers, variations, settings…) answer 403 CONFIRMATION_REQUIRED until the user
// confirms it's them with an authenticator code or a passkey. The axios interceptor (lib/axios.ts) asks the mounted
// <ConfirmationDialog /> for a token here and retries the request with it, so every mutation gets this for free.

export type ConfirmMode = "action" | "window";

export interface ConfirmationMethods {
  totp: boolean;
  passkey: boolean;
}

export interface ConfirmationPrompt {
  mode: ConfirmMode;
  methods: ConfirmationMethods;
  /** The token to retry with, or null when the user closed the dialog. */
  resolve: (token: string | null) => void;
}

type Listener = (prompt: ConfirmationPrompt) => void;

let listener: Listener | null = null;
let open: Promise<string | null> | null = null;

/** The dialog registers itself; returns the unregister function. */
export function onConfirmationPrompt(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/**
 * Opens the dialog (or joins the one already open: two requests failing together get one prompt; the window opened by
 * the first confirmation covers both, and an action that needs its own token is asked again on retry).
 */
export function requestConfirmation(mode: ConfirmMode, methods: ConfirmationMethods): Promise<string | null> {
  if (!listener) return Promise.resolve(null);
  if (open) return open;
  const show = listener;
  open = new Promise<string | null>((resolve) => show({ mode, methods, resolve })).finally(() => {
    open = null;
  });
  return open;
}
