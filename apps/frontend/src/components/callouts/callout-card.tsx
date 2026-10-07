"use client";

import { useState } from "react";
import { Icon, icons } from "@/components/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CALLOUT_KINDS } from "@/lib/callouts";
import { cn } from "@/lib/utils";
import { CalloutArt } from "./callout-art";

// Longer than this and the body opens on "More".
const LONG_BODY = 170;

/**
 * One callout: generated artwork with its kind, then the content itself (a figure if it has one, the title, the body).
 * The sidebar adds dismissing and paging; the management page shows it as a preview.
 */
export function CalloutCard({
  callout,
  onDismiss,
  footer,
  className,
}: {
  callout: Pick<ViewerCallout, "id" | "kind" | "title" | "body" | "highlight" | "pinned">;
  onDismiss?: () => void;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const kind = CALLOUT_KINDS[callout.kind];
  const long = callout.body.length > LONG_BODY;

  return (
    <article
      aria-label={callout.title || kind.label}
      className={cn("overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs", className)}
    >
      <div className="relative">
        <CalloutArt kind={callout.kind} seed={`${callout.id}:${callout.title}`} />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-xs backdrop-blur-sm">
          <Icon icon={kind.icon} size={12} />
          {kind.label}
          {callout.pinned && (
            <>
              <span aria-hidden className="text-muted-foreground">·</span>
              <Icon icon={icons.pin} size={11} aria-label="Pinned" />
            </>
          )}
        </span>
        {onDismiss && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/35 text-white transition-colors hover:bg-black/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Icon icon={icons.x} size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Hide this here</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="grid gap-1 px-3 pt-2.5 pb-3">
        {callout.highlight && (
          <p className="text-2xl leading-tight font-semibold tracking-tight text-brand tabular-nums dark:text-[var(--primary-ink)]">
            {callout.highlight}
          </p>
        )}
        <h3 className="text-sm leading-snug font-semibold text-foreground">{callout.title || "Untitled"}</h3>
        <p className={cn("text-xs leading-relaxed text-muted-foreground", long && !open && "line-clamp-4")}>
          {callout.body || "What it says shows here."}
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="justify-self-start rounded text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {open ? "Less" : "More"}
          </button>
        )}
        {footer}
      </div>
    </article>
  );
}
