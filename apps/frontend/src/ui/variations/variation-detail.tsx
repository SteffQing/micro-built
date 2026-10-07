"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { DisabledHint } from "@/components/disabled-hint";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  currentLagosMonth,
  getVariationFile,
  getVariationPreview,
  monthEnded,
  monthTitle,
  variationPreviewKey,
  type GenerateVariationsResult,
  type VariationAction,
  type VariationHistoryItem,
  type VariationLock,
  type VariationReason,
  type VariationState,
} from "@/lib/payroll/variations";
import { cn } from "@/lib/utils";
import { errorMessage } from "./errors";
import { dayLabel, whenLabel } from "./format";
import { GenerateDialog } from "./generate-dialog";
import { NoPayrollDialog, RevertNoPayrollDialog, RevertVoucherDialog } from "./lock-actions";
import {
  VariationRowsSkeleton,
  VariationTable,
  actionHints,
  actionLabels,
  actionTone,
  reasonLabels,
} from "./variation-table";

type Tone = "success" | "warning" | "muted" | "danger";

/**
 * A glowing chip saying the variation is stale. Its explanation opens by itself for a few seconds when the variation
 * is shown, so it's noticed, then only on hover or focus.
 */
function RegenerateHint({ superAdmin }: { superAdmin: boolean }) {
  const [intro, setIntro] = useState(true);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIntro(false), 6000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Tooltip
      open={intro || hover}
      onOpenChange={(open) => {
        setHover(open);
        if (!open) setIntro(false);
      }}
    >
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="relative inline-flex h-6 cursor-help items-center gap-1 rounded-full border border-warning/50 bg-warning/15 px-2.5 text-xs font-semibold whitespace-nowrap text-warning shadow-[0_0_12px_2px] shadow-warning/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-warning" />
          </span>
          Regenerate
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 leading-5">
        An earlier month locked or was reverted after this was generated, so its penalties can change these amounts.
        Generate it again to pick them up{superAdmin ? "" : " (a super admin can do this)"}.
      </TooltipContent>
    </Tooltip>
  );
}

const toneClass: Record<Tone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  muted: "border-border bg-muted text-muted-foreground",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

/** Where one variation stands, as a chip. */
export function StateChip({ state, skipped }: { state: VariationState | null; skipped?: boolean }) {
  const chip: { tone: Tone; label: string } = state
    ? state.lock?.kind === "VOUCHER"
      ? { tone: "success", label: "Locked · voucher" }
      : state.lock?.kind === "NO_PAYROLL"
        ? { tone: "danger", label: "Locked · no payroll" }
        : { tone: "success", label: `Generated · v${state.version}` }
    : skipped
      ? { tone: "muted", label: "Skipped" }
      : { tone: "warning", label: "Not generated" };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
        toneClass[chip.tone],
      )}
    >
      {chip.label}
    </span>
  );
}

/** A history row's state: generated and waiting, or how it was locked. */
function HistoryChip({ lock }: { lock: VariationLock | null }) {
  const chip: { tone: Tone; label: string } = !lock
    ? { tone: "warning", label: "Awaiting voucher" }
    : lock.kind === "VOUCHER"
      ? { tone: "muted", label: "Voucher" }
      : { tone: "danger", label: "No payroll" };
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
        toneClass[chip.tone],
      )}
    >
      {chip.label}
    </span>
  );
}

function Banner({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", toneClass[tone])}>
      <Icon icon={tone === "success" ? icons.checkCircle : icons.alertTriangle} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

/** One organization's variation for one month: its state, what it changes, and what a super admin can do next. */
export function VariationDetail({
  organization,
  period,
  superAdmin,
  history,
  aside,
}: {
  organization: { id: string; name: string };
  /** YYYY-MM */
  period: string;
  superAdmin: boolean;
  /** The organization's other variations: what decides whether a voucher can still be reverted. */
  history: VariationHistoryItem[];
  /** Beside the summary and filters (the history), as tall as they are; the table spans the full width below. */
  aside?: ReactNode;
}) {
  const [action, setAction] = useState<VariationAction | "ALL">("ALL");
  const [reason, setReason] = useState<VariationReason | "ALL">("ALL");
  const [waiting, setWaiting] = useState<{ version: number; since: number } | null>(null);
  const [notice, setNotice] = useState<GenerateVariationsResult | null>(null);

  const filters = {
    action: action === "ALL" ? undefined : action,
    reason: reason === "ALL" ? undefined : reason,
  };
  const preview = useQuery({
    queryKey: variationPreviewKey(organization.id, period, filters),
    queryFn: () => getVariationPreview(organization.id, period, filters),
    retry: 1,
    // Another filter keeps the table on screen while it loads; another organization or month doesn't.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === organization.id && previousQuery?.queryKey[2] === period ? previous : undefined,
    // A generation runs as a background job: look for the new version until it lands (or three minutes pass).
    refetchInterval: (query) => {
      if (!waiting) return false;
      const version = query.state.data?.variation?.version ?? 0;
      return version > waiting.version || query.state.dataUpdatedAt - waiting.since > 180_000 ? false : 3_000;
    },
  });
  const download = useMutation({ mutationFn: getVariationFile });

  const data = preview.data;
  const variation = data?.variation ?? null;
  const lock = variation?.lock ?? null;
  const locked = lock !== null;
  const total = data ? data.counts.START + data.counts.AMEND + data.counts.STOP : 0;
  const currentVersion = variation?.version ?? 0;
  const generating = waiting !== null && currentVersion <= waiting.version && preview.dataUpdatedAt - waiting.since <= 180_000;
  const ended = monthEnded(period);
  const thisMonth = currentLagosMonth();
  const laterVariation = history.some((item) => item.period.ym > period);
  const laterLocked = history.some((item) => item.period.ym > period && item.lock);
  const label = monthTitle(period);

  const blockedReason = data?.generateBlockedBy ?? null;
  const canGenerate = superAdmin && Boolean(data) && !locked && !data?.skipped && !blockedReason && !generating;
  const generateHint = !superAdmin
    ? "Only a super admin can generate a variation"
    : generating
      ? "A generation is already running"
      : (blockedReason ?? (data?.skipped ? `${organization.name} has no deductions for ${label}` : null));

  const voucherRevertHint = laterVariation
    ? `${organization.name} already has a variation for a later month`
    : period !== thisMonth
      ? "A voucher can only be reverted during its own month"
      : null;
  const noPayrollRevertHint = laterLocked ? "A later month already has its voucher (or no payroll)" : null;

  function openFile() {
    if (!variation) return;
    download.mutate(
      { id: variation.id },
      { onSuccess: (file) => window.open(file.url, "_blank", "noopener,noreferrer") },
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Below lg this column dissolves into the grid, so the history (the aside) sits between summary and filters. */}
        <div className="contents lg:grid lg:min-w-0 lg:content-start lg:gap-4">
          <section className="min-w-0 rounded-xl border bg-card">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0 space-y-1.5">
                <h2 className="truncate text-base font-semibold">
                  {organization.name} · {label}
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {!data ? (
                    <Skeleton className="h-6 w-28 rounded-full" />
                  ) : lock?.kind === "VOUCHER" ? (
                    <>
                      {/* The voucher's details sit behind the chip; its inflows are one click away beside it. */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            tabIndex={0}
                            className="cursor-help rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <StateChip state={variation} skipped={data.skipped} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72">
                          Locked by the voucher <span className="font-medium">{lock.filename}</span>, uploaded{" "}
                          {dayLabel(lock.uploadedAt)}. Its deductions are settled, so it can&apos;t be generated again.
                        </TooltipContent>
                      </Tooltip>
                      <Link
                        href={`/repayments?tab=inflows&voucher=${lock.voucherId}`}
                        className="inline-flex h-6 items-center gap-0.5 rounded-md text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        Inflows <Icon icon={icons.chevronRight} size={12} />
                      </Link>
                    </>
                  ) : (
                    <StateChip state={variation} skipped={data.skipped} />
                  )}
                  {variation && !locked && variation.regenerateHint && (
                    <RegenerateHint key={variation.id} superAdmin={superAdmin} />
                  )}
                  {variation && !locked && ended && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          className="inline-flex h-6 cursor-help items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 text-xs font-medium whitespace-nowrap text-warning focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <Icon icon={icons.alertTriangle} size={12} />
                          Voucher overdue
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64 leading-5">
                        {label} has ended and its voucher hasn&apos;t been uploaded.{" "}
                        {superAdmin
                          ? "Upload it, or mark the month as no payroll if payroll never sent one."
                          : "A super admin uploads it, or marks the month as no payroll."}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {variation && (
                    <p className="text-xs text-muted-foreground">
                      Version {variation.version} · last generated {whenLabel(variation.updatedAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {superAdmin &&
                  !locked &&
                  (canGenerate ? (
                    <GenerateDialog
                      period={period}
                      periodLabel={label}
                      organization={organization}
                      preview={data}
                      onQueued={(result) => {
                        setNotice(result);
                        if (result.queued.some((queued) => queued.id === organization.id)) {
                          setWaiting({ version: currentVersion, since: Date.now() });
                        }
                      }}
                      trigger={
                        <Button type="button">
                          <Icon icon={icons.fileSpreadsheet} size={16} />
                          {variation ? `Regenerate (v${currentVersion + 1})` : "Generate"}
                        </Button>
                      }
                    />
                  ) : (
                    <DisabledHint reason={generateHint}>
                      <Button type="button" disabled loading={generating}>
                        <Icon icon={icons.fileSpreadsheet} size={16} />
                        {generating ? "Generating…" : variation ? `Regenerate (v${currentVersion + 1})` : "Generate"}
                      </Button>
                    </DisabledHint>
                  ))}

                {variation && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={download.isPending}
                    loading={download.isPending}
                    onClick={openFile}
                  >
                    <Icon icon={icons.download} size={16} />
                    Download v{variation.version}
                  </Button>
                )}

                {superAdmin && variation && !locked && (
                  <DisabledHint reason={ended ? null : `Available once ${label} has ended (Lagos time)`}>
                    <NoPayrollDialog
                      variationId={variation.id}
                      label={label}
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                          disabled={!ended}
                        >
                          No payroll
                        </Button>
                      }
                    />
                  </DisabledHint>
                )}

                {superAdmin && lock?.kind === "VOUCHER" && (
                  <DisabledHint reason={voucherRevertHint}>
                    <RevertVoucherDialog
                      voucherId={lock.voucherId}
                      label={label}
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                          disabled={Boolean(voucherRevertHint)}
                        >
                          <Icon icon={icons.refresh} size={16} />
                          Revert voucher
                        </Button>
                      }
                    />
                  </DisabledHint>
                )}

                {superAdmin && variation && lock?.kind === "NO_PAYROLL" && (
                  <DisabledHint reason={noPayrollRevertHint}>
                    <RevertNoPayrollDialog
                      variationId={variation.id}
                      label={label}
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                          disabled={Boolean(noPayrollRevertHint)}
                        >
                          <Icon icon={icons.refresh} size={16} />
                          Revert no payroll
                        </Button>
                      }
                    />
                  </DisabledHint>
                )}
              </div>
            </div>

            {(data || preview.isError || notice || generating) && (
              <div className="grid gap-2 border-t p-4 empty:hidden sm:px-5">
                {preview.isError && <Banner tone="danger">{errorMessage(preview.error)}</Banner>}
                {generating && (
                  <Banner tone="warning">
                    <p>
                      Generating version {currentVersion + 1} in the background. This page updates when it lands; you&apos;ll
                      also get a notification.
                    </p>
                  </Banner>
                )}
                {notice && notice.refused.length > 0 && (
                  <Banner tone="danger">
                    {notice.refused.map((refused) => (
                      <p key={refused.id}>{refused.reason}</p>
                    ))}
                  </Banner>
                )}
                {data?.skipped && !variation && (
                  <Banner tone="muted">
                    <p>
                      {organization.name} has no deductions for {label}, so there is nothing to generate and no voucher to
                      expect. It&apos;s skipped for this month.
                    </p>
                  </Banner>
                )}
                {lock?.kind === "NO_PAYROLL" && (
                  <Banner tone="danger">
                    <p className="font-medium">Marked as no payroll</p>
                    <p>{lock.reason}</p>
                  </Banner>
                )}
              </div>
            )}
          </section>

          <section aria-label="Filter changes" className="order-1 grid min-w-0 gap-3 lg:order-none rounded-xl border bg-card p-4 sm:p-5">
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
                      "rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Select value={reason} onValueChange={(value) => setReason(value as VariationReason | "ALL")}>
                <SelectTrigger className="h-9 w-[180px] text-sm" aria-label="Filter by reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All reasons</SelectItem>
                  {(Object.keys(reasonLabels) as VariationReason[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {reasonLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {data
                  ? locked
                    ? `What version ${variation?.version} of the file holds`
                    : `Generating freezes ${data.frozen} ${data.frozen === 1 ? "deduction" : "deductions"}, unchanged ones included`
                  : "Loading…"}
              </p>
            </div>
          </section>
        </div>
        {/* The aside fills its box absolutely, so on wide screens it matches the column beside it without stretching it. */}
        {aside && <div className="relative h-80 min-w-0 lg:h-auto">{aside}</div>}
      </div>

      <section aria-label="Changes" className="grid min-w-0 gap-3 rounded-xl border bg-card p-4 sm:p-5">
        {preview.isLoading ? (
          <VariationRowsSkeleton />
        ) : data ? (
          !variation && !data.skipped && total === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm font-medium">Nothing has changed for {organization.name}</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Generating still sends the organization a variation with only the column headings, so it has one for the
                month and its voucher can be uploaded.
              </p>
            </div>
          ) : (
            <VariationTable rows={data.rows} />
          )
        ) : null}
      </section>
    </div>
  );
}

/** An organization's variations, newest month first. Picking one opens that month. */
export function HistoryList({
  items,
  selected,
  onSelect,
  organizationName,
  className,
  loading,
}: {
  items: VariationHistoryItem[];
  selected: string;
  onSelect: (ym: string) => void;
  organizationName: string;
  className?: string;
  loading?: boolean;
}) {
  return (
    <section
      aria-label="History"
      className={cn("absolute inset-0 flex min-w-0 flex-col rounded-xl border bg-card p-4", className)}
    >
      <h3 className="text-sm font-semibold">History</h3>
      <p className="text-xs text-muted-foreground">{organizationName}&apos;s variations, newest month first</p>
      {loading ? (
        <div className="mt-3 grid gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing has been generated for this organization yet.</p>
      ) : (
        <ul className="thin-scroll -mr-2 mt-3 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto overscroll-contain pr-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.period.ym)}
                aria-current={item.period.ym === selected ? "true" : undefined}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  item.period.ym === selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{monthTitle(item.period.ym)}</span>
                  <span className="block text-xs text-muted-foreground">
                    v{item.version} · {dayLabel(item.updatedAt)}
                  </span>
                </span>
                <HistoryChip lock={item.lock} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
