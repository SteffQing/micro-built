"use client";

import { Icon, icons } from "@/components/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CALLOUT_KINDS } from "@/lib/callouts";
import { cn } from "@/lib/utils";
import { CalloutArt } from "./callout-art";

/**
 * One callout, as tall as what it says: generated artwork carrying its kind (and its figure, if it has one), then the
 * title and body (at most two and four lines, which the text limits are sized for). The sidebar adds dismissing and
 * paging in the footer row, and eases between heights as callouts change; the management page shows it as a preview.
 * A pinned callout can't be dismissed.
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
  const kind = CALLOUT_KINDS[callout.kind];

  return (
    <article
      aria-label={callout.title || kind.label}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs",
        className,
      )}
    >
      <div className="relative h-16 shrink-0">
        <CalloutArt kind={callout.kind} seed={`${callout.id}:${callout.title}`} className="h-16" />
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
        {callout.highlight && (
          <span className="absolute right-2 bottom-2 max-w-[60%] truncate rounded-lg bg-background/90 px-2 py-0.5 text-base leading-tight font-semibold tracking-tight text-brand tabular-nums shadow-xs backdrop-blur-sm dark:text-[var(--primary-ink)]">
            {callout.highlight}
          </span>
        )}
        {onDismiss && !callout.pinned && (
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

      <div className="flex flex-col gap-1 px-3 pt-2.5 pb-2.5">
        <h3 className="line-clamp-2 shrink-0 text-sm leading-snug font-semibold text-foreground">
          {callout.title || "Untitled"}
        </h3>
        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
          {callout.body || "What it says shows here."}
        </p>
        {footer && <div className="mt-1 flex h-6 shrink-0 items-center">{footer}</div>}
      </div>
    </article>
  );
}
