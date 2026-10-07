"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalloutCard } from "@/components/callouts/callout-card";
import { allCallouts } from "@/lib/queries/callouts";
import { deleteCallout, updateCallout } from "@/lib/mutations/admin/callouts";
import {
  CALLOUT_AUDIENCES,
  CALLOUT_LIFETIME_DAYS,
  CALLOUT_PRIORITIES,
  CALLOUTS_PER_VIEWER,
  daysLeft,
  expiryLabel,
  liveFor,
} from "@/lib/callouts";
import { cn } from "@/lib/utils";
import { CalloutEditor } from "./callout-editor";

type Filter = "ALL" | CalloutStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Drafts" },
];

/** What each role's sidebar offers now, from the published callouts. */
function LiveNow({ callouts }: { callouts: Callout[] }) {
  return (
    <section aria-labelledby="live-now" className="min-w-0 rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="live-now" className="text-sm font-semibold">
          Live now
        </h3>
        <p className="text-xs text-muted-foreground">
          Each person gets up to {CALLOUTS_PER_VIEWER}: the pinned one first, then by priority and the newest. Every
          callout but the pinned one is deleted {CALLOUT_LIFETIME_DAYS} days after it&apos;s created, unless renewed.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CALLOUT_AUDIENCES.map(({ value, label }) => {
          const live = liveFor(value, callouts);
          return (
            <div key={value} className="min-w-0 rounded-lg bg-muted/50 p-3">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
              {live.length ? (
                <ol className="grid gap-1.5">
                  {live.map((callout, i) => (
                    <li key={callout.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-background text-[10px] font-medium tabular-nums">
                        {i + 1}
                      </span>
                      <span className="line-clamp-2 min-w-0 flex-1 break-words" title={callout.title}>
                        {callout.title}
                      </span>
                      {callout.pinned && <Icon icon={icons.pin} size={14} className="shrink-0 text-primary" aria-label="Pinned" />}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing yet</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeleteCallout({ callout }: { callout: Callout }) {
  const [open, setOpen] = useState(false);
  const remove = useMutation(deleteCallout);
  if (callout.pinned) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A disabled button swallows pointer events; the span keeps its tooltip reachable. */}
          <span tabIndex={0} className="inline-flex">
            <Button variant="ghost" size="icon" className="size-8" disabled aria-label={`Delete ${callout.title}`}>
              <Icon icon={icons.delete} size={16} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>A pinned callout stays. Unpin it to delete it.</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${callout.title}`}
            onClick={() => setOpen(true)}
          >
            <Icon icon={icons.delete} size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this callout?</DialogTitle>
            <DialogDescription>
              &ldquo;{callout.title}&rdquo; goes from everyone&apos;s sidebar and from this list. To take it down for now, unpublish
              it instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate(callout.id, { onSuccess: () => setOpen(false) })}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CalloutRow({ callout, onEdit }: { callout: Callout; onEdit: () => void }) {
  const update = useMutation(updateCallout);
  const published = callout.status === "PUBLISHED";
  const priority = CALLOUT_PRIORITIES.find((p) => p.value === callout.priority)?.label ?? "Normal";
  const days = daysLeft(callout);
  const soon = days !== null && days <= 2;

  return (
    <li className="grid min-w-0 gap-4 rounded-xl border bg-card p-3 sm:grid-cols-[16rem_minmax(0,1fr)] sm:p-4">
      <CalloutCard callout={callout} className={cn(!published && "opacity-70")} />

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {published ? "Published" : "Draft"}
          </span>
          {callout.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <Icon icon={icons.pin} size={12} />
              Pinned
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{priority} priority</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  days === null
                    ? "bg-muted text-muted-foreground"
                    : soon
                      ? "bg-warning/15 text-warning"
                      : "bg-muted text-muted-foreground",
                )}
              >
                <Icon icon={icons.calendarClock} size={12} />
                {days === null ? "Stays while pinned" : expiryLabel(days)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {callout.expiresAt
                ? `Deleted on ${format(new Date(callout.expiresAt), "d MMM yyyy, h:mm a")}. Renew it for ${CALLOUT_LIFETIME_DAYS} more days.`
                : "Pinned callouts are never deleted. Unpinned, it gets a fresh 7 days."}
            </TooltipContent>
          </Tooltip>
        </div>

        <dl className="grid gap-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">For</dt>
            <dd>
              {CALLOUT_AUDIENCES.filter((a) => callout.audience.includes(a.value))
                .map((a) => a.label)
                .join(", ") || "No one yet"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <dt className="sr-only">History</dt>
            <dd>
              By {callout.createdBy}
              {callout.publishedAt && published && <> · published {format(new Date(callout.publishedAt), "d MMM yyyy")}</>}
              {" · "}edited {format(new Date(callout.updatedAt), "d MMM yyyy, h:mm a")}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={published}
              disabled={update.isPending || (!published && !callout.audience.length)}
              onCheckedChange={(on) => update.mutate({ id: callout.id, status: on ? "PUBLISHED" : "DRAFT" })}
            />
            Published
          </label>

          <Tooltip>
            <TooltipTrigger asChild>
              {/* A disabled button swallows pointer events; the span keeps its tooltip reachable. */}
              <span tabIndex={published ? -1 : 0} className="inline-flex">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!published || update.isPending}
                  onClick={() => update.mutate({ id: callout.id, pinned: !callout.pinned })}
                >
                  <Icon icon={callout.pinned ? icons.pinOff : icons.pin} size={14} />
                  {callout.pinned ? "Unpin" : "Pin"}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">
              {published
                ? callout.pinned
                  ? "Stop showing it first"
                  : "Show it first to everyone it's for; any other pinned callout lets go"
                : "Publish it to pin it"}
            </TooltipContent>
          </Tooltip>

          {!callout.pinned && (
            <Button
              variant={soon ? "default" : "outline"}
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: callout.id, renew: true })}
            >
              <Icon icon={icons.refresh} size={14} />
              Renew {CALLOUT_LIFETIME_DAYS} days
            </Button>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Icon icon={icons.edit} size={14} />
              Edit
            </Button>
            <DeleteCallout callout={callout} />
          </div>
        </div>
      </div>
    </li>
  );
}

/** SUPER_ADMIN: write, publish, pin and retire the callouts at the foot of everyone's sidebar. */
export function CalloutsPage() {
  const { data, isLoading } = useQuery(allCallouts);
  const [filter, setFilter] = useState<Filter>("ALL");
  // The editor mounts afresh for each callout (or a new one), so it starts from what it's editing.
  const [editing, setEditing] = useState<{ key: string; callout?: Callout } | null>(null);

  const callouts = data ?? [];
  const shown = filter === "ALL" ? callouts : callouts.filter((c) => c.status === filter);

  return (
    <div className="min-w-0 space-y-3 p-3 lg:space-y-5 lg:p-5">
      <PageTitle
        title="Callouts"
        actionContent={
          <Button className="btn-gradient" onClick={() => setEditing({ key: `new-${Date.now()}` })}>
            <Icon icon={icons.plus} size={16} />
            New callout
          </Button>
        }
      />

      <LiveNow callouts={callouts} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filter callouts" className="inline-flex rounded-lg border bg-card p-0.5">
          {FILTERS.map(({ value, label }) => {
            const count = value === "ALL" ? callouts.length : callouts.filter((c) => c.status === value).length;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label} <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">People can hide a callout in their own browser; that isn&apos;t recorded here.</p>
      </div>

      {isLoading ? (
        <ul className="grid gap-3" aria-busy>
          {[0, 1].map((i) => (
            <li key={i} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[16rem_1fr]">
              <Skeleton className="h-60 rounded-xl" />
              <div className="grid content-start gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-3 w-48" />
              </div>
            </li>
          ))}
        </ul>
      ) : shown.length ? (
        <ul className="grid gap-3">
          {shown.map((callout) => (
            <CalloutRow
              key={callout.id}
              callout={callout}
              onEdit={() => setEditing({ key: `${callout.id}-${callout.updatedAt}`, callout })}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-10 text-center">
          <Icon icon={icons.callouts} size={28} className="text-muted-foreground" />
          <p className="text-sm font-medium">{filter === "ALL" ? "No callouts yet" : `No ${filter === "DRAFT" ? "drafts" : "published callouts"}`}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Callouts are short tips, news and figures at the foot of the sidebar. Start one from an example.
          </p>
          <Button variant="outline" className="mt-2" onClick={() => setEditing({ key: `new-${Date.now()}` })}>
            <Icon icon={icons.plus} size={16} />
            New callout
          </Button>
        </div>
      )}

      {editing && (
        <CalloutEditor
          key={editing.key}
          callout={editing.callout}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </div>
  );
}
