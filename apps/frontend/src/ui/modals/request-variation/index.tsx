"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { visibleEmail } from "@microbuilt/shared";
import { Icon, icons } from "@/components/icon";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserProvider } from "@/store/auth";
import { requestVariationSchedule, submitVariationSchedule } from "@/lib/mutations/admin/repayments";
import {
  getVariationFile,
  getVariationPreview,
  variationPreviewKey,
  type VariationAction,
  type VariationPeriod,
} from "@/lib/payroll/variations";
import { cn, formatCurrency } from "@/lib/utils";
import { MonthPicker } from "./month-picker";
import { RevertVariation } from "./revert-variation";
import {
  VariationRows,
  VariationRowsSkeleton,
  actionHints,
  actionLabels,
  actionTone,
} from "./variation-rows";

const errorMessage = (error: unknown) => {
  const message = isAxiosError(error)
    ? error.response?.data?.message
    : error instanceof Error
      ? error.message
      : null;
  return Array.isArray(message)
    ? message.join(". ")
    : typeof message === "string"
      ? message
      : "Could not complete this request. Please retry.";
};

const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Africa/Lagos",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}`;
};

const formatShort = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));

/** Where the month stands, as one chip; the explanation lives in its tooltip. */
function StatusChip({ period }: { period: VariationPeriod }) {
  const state = period.closedAt ? "closed" : period.submittedAt ? "generated" : "draft";
  const chip = {
    closed: {
      icon: icons.lock,
      label: "Closed",
      tone: "border-border bg-muted text-muted-foreground",
      hint: "Payroll results are final for this month. The file stays available to download.",
    },
    generated: {
      icon: icons.checkCircle,
      label: `Generated ${period.submittedAt ? formatShort(period.submittedAt) : ""}`,
      tone: "border-success/30 bg-success/10 text-success",
      hint: period.revertBlockedBy
        ? `Deductions are frozen at these amounts; send payroll the file. Can't be reverted: ${period.revertBlockedBy}.`
        : "Deductions are frozen at these amounts; send payroll the file. A super admin can revert it until payroll money comes in.",
    },
    draft: {
      icon: icons.calendarClock,
      label: "Not generated",
      tone: "border-border bg-muted/60 text-muted-foreground",
      hint: "Review the changes and email yourself a draft. Generating freezes the deductions, opens next month and emails the file to every super admin.",
    },
  }[state];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            chip.tone,
          )}
        >
          <Icon icon={chip.icon} size={14} />
          {chip.label}
          <Icon icon={icons.info} size={13} className="opacity-60" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72">
        <p>{chip.hint}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function RequestVariationSchedule({
  role,
  defaultOpen = false,
}: {
  role: "ADMIN" | "SUPER_ADMIN";
  defaultOpen?: boolean;
}) {
  const superAdmin = role === "SUPER_ADMIN";
  const { user } = useUserProvider();
  // Drafts go to the signed-in admin only; phone-only accounts have no address to send to.
  const email = visibleEmail(user?.email);
  const [open, setOpen] = useState(defaultOpen);
  const [month, setMonth] = useState(currentMonth);
  const [viewYear, setViewYear] = useState(() => Number(currentMonth().slice(0, 4)));
  const [action, setAction] = useState<VariationAction | "ALL">("ALL");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");

  const actionFilter = action === "ALL" ? undefined : action;
  const preview = useQuery({
    queryKey: variationPreviewKey(month, { action: actionFilter }),
    queryFn: () => getVariationPreview(month, { action: actionFilter }),
    enabled: open && Boolean(month),
    retry: 1,
  });
  const drafting = useMutation(requestVariationSchedule);
  const submission = useMutation(submitVariationSchedule);
  const download = useMutation({ mutationFn: getVariationFile });
  const busy = drafting.isPending || submission.isPending || download.isPending;

  const data = preview.data;
  const period = data?.period;
  const submitted = Boolean(period?.submittedAt);
  const closed = Boolean(period?.closedAt);
  const canRevert = superAdmin && submitted && !closed && !period?.revertBlockedBy;
  const canGenerate = superAdmin && !submitted && !closed && Boolean(data);
  const total = data?.counts ? data.counts.START + data.counts.AMEND + data.counts.STOP : 0;
  const shownAmount = data?.rows.reduce((sum, row) => sum + (row.action === "STOP" ? 0 : row.amount), 0) ?? 0;

  function resetTransient() {
    setAcknowledged(false);
    setError("");
  }

  function changeMonth(next: string) {
    setMonth(next);
    resetTransient();
  }

  async function run(work: () => Promise<unknown>, after?: () => void) {
    setError("");
    try {
      await work();
      after?.();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  const sendDraft = () => run(() => drafting.mutateAsync({ period: month }));
  const generate = () => run(() => submission.mutateAsync({ period: month }), resetTransient);
  const downloadFile = () =>
    run(async () => {
      try {
        const file = await download.mutateAsync(month);
        window.open(file.url, "_blank", "noopener,noreferrer");
      } catch (failure) {
        toast.error("Could not open the file");
        throw failure;
      }
    });

  const shownError = error || (preview.isError ? errorMessage(preview.error) : "");

  const draftButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button swallows pointer events; the span keeps its tooltip reachable. */}
        <span tabIndex={email ? -1 : 0} className="w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={busy || !email || !data}
            onClick={sendDraft}
          >
            <Icon icon={icons.mail} size={16} />
            {drafting.isPending ? "Sending…" : "Email me a draft"}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <p>
          {email
            ? `Sends the file to ${email} for checking. Nothing is frozen or sent to payroll.`
            : "Add an email address to your account to receive drafts."}
        </p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetTransient();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-10 w-full border-destructive/40 bg-card px-4 font-normal text-brand hover:bg-destructive/5 sm:w-auto"
        >
          <Icon icon={icons.fileSpreadsheet} size={16} />
          Schedule Variation
        </Button>
      </DialogTrigger>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-2xl">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon icon={icons.fileSpreadsheet} size={20} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>Payroll variation</DialogTitle>
              <DialogDescription>What payroll must start, change or stop deducting for a month.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className={cn(dialogBodyClass, "min-w-0 pt-4")}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid w-full gap-1.5 sm:max-w-xs">
              <Label className="text-xs text-muted-foreground">Payroll month</Label>
              <MonthPicker value={month} onChange={changeMonth} viewYear={viewYear} onViewYearChange={setViewYear} />
            </div>
            <div className="flex items-center gap-1 sm:pb-1.5">
              {period ? <StatusChip period={period} /> : <Skeleton className="h-7 w-32 rounded-full" />}
              {canRevert && period && <RevertVariation month={month} label={period.label} errorMessage={errorMessage} />}
            </div>
          </div>

          <section aria-label="Changes" className="grid gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Filter by action">
              {(["ALL", "START", "AMEND", "STOP"] as const).map((key) => {
                const active = action === key;
                const count = key === "ALL" ? total : data?.counts[key];
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setAction(key)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                          key === "ALL" ? "bg-muted text-muted-foreground" : actionTone[key],
                        )}
                      >
                        {key === "ALL" ? "All" : actionLabels[key]}
                      </span>
                      {data ? (
                        <span className="text-lg font-semibold tabular-nums">{count}</span>
                      ) : (
                        <Skeleton className="h-6 w-6" />
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {key === "ALL" ? "Every change" : actionHints[key]}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>{data ? `${data.rows.length} ${data.rows.length === 1 ? "loan" : "loans"}` : "Loading…"}</span>
              {data && data.rows.length > 0 && (
                <span>
                  Monthly deductions:{" "}
                  <span className="font-semibold text-foreground tabular-nums">{formatCurrency(shownAmount)}</span>
                </span>
              )}
            </div>
            {preview.isLoading ? <VariationRowsSkeleton /> : data ? <VariationRows rows={data.rows} /> : null}
          </section>

          {shownError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {shownError}
            </p>
          )}

          {submitted ? (
            <DialogFooter className="border-t pt-4">
              <Button type="button" disabled={busy || !period?.hasFile} onClick={downloadFile}>
                <Icon icon={icons.download} size={16} />
                {download.isPending ? "Opening…" : "Download file"}
              </Button>
            </DialogFooter>
          ) : closed ? null : (
            <DialogFooter className="border-t pt-4 sm:items-center sm:justify-between">
              {canGenerate && data ? (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="variation-ack"
                    className="mt-0.5"
                    checked={acknowledged}
                    disabled={busy}
                    onCheckedChange={(v) => setAcknowledged(v === true)}
                  />
                  <Label htmlFor="variation-ack" className="grid gap-0.5 font-normal">
                    <span>
                      I&apos;ve reviewed the {total} {total === 1 ? "change" : "changes"} for {data.period.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Generating freezes these deductions and emails the file to every super admin
                    </span>
                  </Label>
                </div>
              ) : (
                <span className="hidden sm:block" />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {draftButton}
                {superAdmin && (
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={!canGenerate || !acknowledged || busy}
                    onClick={generate}
                  >
                    <Icon icon={icons.fileSpreadsheet} size={16} />
                    {submission.isPending ? "Generating…" : "Generate variation"}
                  </Button>
                )}
              </div>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
