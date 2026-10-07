"use client";

import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { generateVariationsMutation } from "@/lib/mutations/admin/variations";
import type { GenerateVariationsResult, OrgRef, VariationPreview } from "@/lib/payroll/variations";
import { cn } from "@/lib/utils";
import { errorMessage } from "./errors";
import { monthName } from "./format";

/**
 * SUPER_ADMIN: generate one organization's variation for a month (or every organization's). The API queues one job per
 * organization and the "Confirm it's you" prompt appears when it asks for it; the result says what was queued, skipped
 * and refused.
 */
export function GenerateDialog({
  period,
  periodLabel,
  organization,
  preview,
  trigger,
  onQueued,
}: {
  /** YYYY-MM */
  period: string;
  /** "October 2026" */
  periodLabel: string;
  /** The organization to generate for; null generates for every organization with deductions. */
  organization: OrgRef | null;
  /** The loaded preview of that organization's month (single organization only). */
  preview?: VariationPreview;
  trigger: ReactNode;
  onQueued: (result: GenerateVariationsResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const { mutateAsync, isPending } = useMutation(generateVariationsMutation);

  const variation = preview?.variation ?? null;
  const total = preview ? preview.counts.START + preview.counts.AMEND + preview.counts.STOP : 0;
  const nextVersion = (variation?.version ?? 0) + 1;

  function changeOpen(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setAcknowledged(false);
      setError("");
    }
  }

  async function generate() {
    setError("");
    try {
      const response = await mutateAsync(
        organization ? { period, organizationIds: [organization.id] } : { period, all: true },
      );
      if (response.data) onQueued(response.data);
      changeOpen(false);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  const points: string[] = organization
    ? [
        preview
          ? `${preview.frozen} ${preview.frozen === 1 ? "deduction is" : "deductions are"} frozen at these amounts. The file lists the ${total} that changed; the rest stay on what payroll already has.`
          : "The deductions for the month are frozen at these amounts.",
        variation
          ? `Version ${variation.version} is replaced by version ${nextVersion}. Older versions stay available to download until the variation locks.`
          : "This is the first version. You can generate again as often as needed, and each version replaces the last.",
        "Generating again is possible until the organization's voucher (or a no payroll) locks the month.",
        "It runs in the background; you'll get a notification when the file is ready.",
      ]
    : [
        `Every organization with deductions for ${periodLabel} gets a new variation. Organizations with none are skipped.`,
        "An organization that already has an unlocked variation for the month gets a new version in its place.",
        "Organizations that can't be generated yet (an earlier month is still ungenerated, or the month is locked) are listed afterwards, with the reason.",
        "Each runs in the background; you'll get a notification as each one finishes.",
      ];

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-lg">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon icon={icons.fileSpreadsheet} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>
                {organization ? `Generate ${organization.name}'s variation` : "Generate every organization's variation"}
              </DialogTitle>
              <DialogDescription>
                {periodLabel}. You&apos;ll confirm it with your authenticator code or a passkey.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className={cn(dialogBodyClass, "min-w-0 pt-4")}>
          <ul className="grid gap-1.5 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <div className="flex items-start gap-2">
            <Checkbox
              id="generate-ack"
              className="mt-0.5"
              checked={acknowledged}
              disabled={isPending}
              onCheckedChange={(value) => setAcknowledged(value === true)}
            />
            <Label htmlFor="generate-ack" className="font-normal">
              {organization
                ? total === 1
                  ? "I've reviewed this change"
                  : `I've reviewed these ${total} changes`
                : "I understand each organization's variation is regenerated"}
            </Label>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter className="border-t pt-4">
            <Button type="button" disabled={!acknowledged || isPending} loading={isPending} onClick={() => void generate()}>
              {organization ? `Generate version ${nextVersion}` : "Generate for all"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** What a generation queued, skipped and refused. */
export function GenerateResult({ result, onDismiss }: { result: GenerateVariationsResult; onDismiss: () => void }) {
  const groups: { key: string; title: string; tone: string; items: { id: string; name: string; note?: string }[] }[] = [
    {
      key: "queued",
      title: `Queued (${result.queued.length})`,
      tone: "text-success",
      items: result.queued.map((o) => ({ id: o.id, name: o.name, note: "Generating in the background" })),
    },
    {
      key: "skipped",
      title: `Skipped (${result.skipped.length})`,
      tone: "text-muted-foreground",
      items: result.skipped.map((o) => ({ id: o.id, name: o.name, note: "No deductions this month" })),
    },
    {
      key: "refused",
      title: `Refused (${result.refused.length})`,
      tone: "text-destructive",
      items: result.refused.map((o) => ({ id: o.id, name: o.name, note: o.reason })),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <section aria-label="Generation result" className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{monthName(result.period.label)} generation</h3>
          <p className="text-xs text-muted-foreground">
            Each queued organization is a background job. You&apos;ll be notified as it finishes; refresh to see the new version.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onDismiss} aria-label="Dismiss the result">
          <Icon icon={icons.x} size={14} />
        </Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.key} className="min-w-0 rounded-lg border p-3">
            <p className={cn("text-xs font-medium", group.tone)}>{group.title}</p>
            <ul className="mt-2 grid gap-1.5">
              {group.items.map((item) => (
                <li key={item.id} className="min-w-0 text-sm">
                  <p className="truncate font-medium">{item.name}</p>
                  {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing was queued.</p>}
      </div>
    </section>
  );
}
