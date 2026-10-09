"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalloutCard } from "@/components/callouts/callout-card";
import {
  CALLOUT_EXAMPLES,
  CALLOUT_KIND_ORDER,
  CALLOUT_KINDS,
  CALLOUT_LIFETIME_DAYS,
  CALLOUT_LIMITS,
  CALLOUT_PRIORITIES,
} from "@/lib/callouts";
import { createCallout, updateCallout } from "@/lib/mutations/admin/callouts";
import { cn } from "@/lib/utils";

type Draft = {
  kind: CalloutKind;
  title: string;
  body: string;
  highlight: string;
  priority: number;
  pinned: boolean;
};

const EMPTY: Draft = { kind: "EDUCATION", title: "", body: "", highlight: "", priority: 1, pinned: false };

const fromCallout = (callout: Callout): Draft => ({
  kind: callout.kind,
  title: callout.title,
  body: callout.body,
  highlight: callout.highlight ?? "",
  priority: callout.priority,
  pinned: callout.pinned,
});

function Counter({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  return (
    <span className={cn("text-xs tabular-nums", left < 0 ? "text-destructive" : "text-muted-foreground")}>
      {value.length}/{max}
    </span>
  );
}

/**
 * Write or edit a callout beside a live preview of it as the sidebar will show it. New callouts can start from an
 * example. Saving keeps a draft; publishing puts it live (and lets it be pinned).
 */
export function CalloutEditor({
  callout,
  open,
  onOpenChange,
}: {
  /** The callout to edit; none for a new one. */
  callout?: Callout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => (callout ? fromCallout(callout) : EMPTY));
  const create = useMutation(createCallout);
  const update = useMutation(updateCallout);
  const busy = create.isPending || update.isPending;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const title = draft.title.trim();
  const body = draft.body.trim();
  const highlight = draft.highlight.trim();
  const fits =
    title.length > 0 &&
    title.length <= CALLOUT_LIMITS.title &&
    body.length > 0 &&
    body.length <= CALLOUT_LIMITS.body &&
    highlight.length <= CALLOUT_LIMITS.highlight;
  const live = callout?.status === "PUBLISHED";

  const save = (status: CalloutStatus) => {
    const input: CalloutInput = {
      kind: draft.kind,
      title,
      body,
      highlight: highlight || null,
      priority: draft.priority,
      status,
      pinned: status === "PUBLISHED" && draft.pinned,
    };
    const done = { onSuccess: () => onOpenChange(false) };
    if (callout) update.mutate({ id: callout.id, ...input }, done);
    else create.mutate(input, done);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{callout ? "Edit callout" : "New callout"}</DialogTitle>
          <DialogDescription>
            A short piece customers read at the foot of their sidebar. Put everything worth knowing in it: there&apos;s no
            link to follow.
          </DialogDescription>
        </DialogHeader>
        <Separator />

        <div className="grid gap-6 px-4 pt-5 pb-5 sm:px-5 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="grid content-start gap-4">
            {!callout && (
              <div className="grid gap-2">
                <Label>Start from an example</Label>
                <Select
                  onValueChange={(name) => {
                    const example = CALLOUT_EXAMPLES.find((e) => e.name === name);
                    if (example) {
                      setDraft({
                        ...EMPTY,
                        kind: example.kind,
                        title: example.title,
                        body: example.body,
                        highlight: example.highlight ?? "",
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Blank" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALLOUT_EXAMPLES.map((example) => (
                      <SelectItem key={example.name} value={example.name}>
                        {CALLOUT_KINDS[example.kind].label}: {example.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Kind</legend>
              <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CALLOUT_KIND_ORDER.map((kind) => {
                  const meta = CALLOUT_KINDS[kind];
                  const active = draft.kind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={meta.hint}
                      onClick={() => set("kind", kind)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                      )}
                    >
                      <Icon icon={meta.icon} size={16} className={active ? "text-primary" : "text-muted-foreground"} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{CALLOUT_KINDS[draft.kind].hint}. It also sets the artwork.</p>
            </fieldset>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="callout-title">Title</Label>
                <Counter value={draft.title} max={CALLOUT_LIMITS.title} />
              </div>
              <Input id="callout-title" value={draft.title} onChange={(e) => set("title", e.target.value)} />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="callout-body">What it says</Label>
                <Counter value={draft.body} max={CALLOUT_LIMITS.body} />
              </div>
              <Textarea
                id="callout-body"
                rows={3}
                value={draft.body}
                onChange={(e) => set("body", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="callout-highlight">Figure to show large (optional)</Label>
                <Counter value={draft.highlight} max={CALLOUT_LIMITS.highlight} />
              </div>
              <Input
                id="callout-highlight"
                placeholder="e.g. 48 hours, ₦2.5m, 1,000+"
                value={draft.highlight}
                onChange={(e) => set("highlight", e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">Priority</legend>
                <div role="radiogroup" className="inline-flex rounded-lg border p-0.5">
                  {CALLOUT_PRIORITIES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={draft.priority === value}
                      onClick={() => set("priority", value)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        draft.priority === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="grid content-start gap-2">
                <span className="text-sm font-medium">Pin</span>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch checked={draft.pinned} onCheckedChange={(on) => set("pinned", on)} />
                  Shown first to every customer
                </label>
                <p className="text-xs text-muted-foreground">
                  Published only. A pinned callout can&apos;t be dismissed and is never deleted.
                </p>
              </div>
            </div>
          </div>

          <div className="grid content-start gap-2">
            <span className="text-sm font-medium">Preview</span>
            <div className="rounded-xl bg-sidebar p-2 md:sticky md:top-0">
              <CalloutCard
                callout={{
                  id: callout?.id ?? "new",
                  kind: draft.kind,
                  title,
                  body,
                  highlight: highlight || null,
                  pinned: draft.pinned,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">The artwork is drawn from the kind and the title.</p>
            {!draft.pinned && (
              <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                <Icon icon={icons.calendarClock} size={14} className="mt-px shrink-0" />
                {callout?.expiresAt
                  ? `Deleted ${format(new Date(callout.expiresAt), "d MMM")} unless renewed or pinned.`
                  : `Deleted ${CALLOUT_LIFETIME_DAYS} days after it's created, unless renewed or pinned.`}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => save("DRAFT")} disabled={!fits || busy}>
            {live ? "Unpublish and save" : "Save draft"}
          </Button>
          <Button onClick={() => save("PUBLISHED")} disabled={!fits || busy}>
            {live ? "Save" : "Publish"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
