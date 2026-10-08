"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Cloudflare Turnstile, for a visitor starting a conversation (C7). The script loads once; the check starts when the
// visitor begins typing (`prepare`), so the token is usually ready by the time they send. Cloudflare decides whether
// the visitor has to do anything: only then does the check cover the chat, and it goes again once they pass.

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
/** Tokens last five minutes; one older than this is thrown away rather than risk a refusal. */
const TOKEN_TTL_MS = 4.5 * 60 * 1000;

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't load")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type TurnstileHandle = {
  /** Start the check now (the visitor started typing). Does nothing while one runs or a fresh token is waiting. */
  prepare: () => void;
  /** A single-use token: the one `prepare` got, or a new check. */
  getToken: () => Promise<string>;
};

/** Turnstile over the chat: invisible unless Cloudflare needs the visitor to do something. Place it in a `relative` box. */
export const Turnstile = forwardRef<TurnstileHandle>(function Turnstile(_, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const pending = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);
  const ready = useRef<{ token: string; at: number } | null>(null);
  const running = useRef<Promise<string> | null>(null);
  const [interactive, setInteractive] = useState(false);

  useEffect(
    () => () => {
      if (widget.current) window.turnstile?.remove(widget.current);
    },
    []
  );

  const fresh = () => !!ready.current && Date.now() - ready.current.at < TOKEN_TTL_MS;

  const run = () => {
    running.current ??= (async () => {
      if (!TURNSTILE_SITE_KEY) throw new Error("Turnstile isn't set up");
      const api = await loadTurnstile();
      return new Promise<string>((resolve, reject) => {
        pending.current = { resolve, reject };
        if (!widget.current && container.current) {
          widget.current = api.render(container.current, {
            sitekey: TURNSTILE_SITE_KEY,
            execution: "execute",
            appearance: "interaction-only",
            callback: (token: string) => {
              setInteractive(false);
              pending.current?.resolve(token);
            },
            "before-interactive-callback": () => setInteractive(true),
            "after-interactive-callback": () => setInteractive(false),
            "error-callback": () => {
              setInteractive(false);
              pending.current?.reject(new Error("Turnstile check failed"));
            },
          });
        } else if (widget.current) {
          api.reset(widget.current);
        }
        if (widget.current) api.execute(widget.current);
      });
    })()
      .then((token) => {
        ready.current = { token, at: Date.now() };
        return token;
      })
      .finally(() => {
        running.current = null;
      });
    return running.current;
  };

  useImperativeHandle(ref, () => ({
    prepare: () => {
      if (fresh() || running.current) return;
      void run().catch(() => undefined);
    },
    getToken: async () => {
      if (!fresh()) {
        ready.current = null;
        await (running.current ?? run());
      }
      const token = ready.current!.token;
      ready.current = null;
      return token;
    },
  }));

  return (
    <div
      role={interactive ? "dialog" : undefined}
      aria-label={interactive ? "Confirm you're human" : undefined}
      aria-hidden={!interactive}
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-card/95 p-6 text-center backdrop-blur-sm transition-opacity duration-200",
        interactive ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {interactive && (
        <div className="grid gap-1">
          <p className="font-semibold">One quick check</p>
          <p className="text-sm text-muted-foreground">Confirm you&apos;re human and you can carry on typing.</p>
        </div>
      )}
      <div ref={container} />
    </div>
  );
});
