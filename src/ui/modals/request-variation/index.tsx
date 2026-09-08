"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUserProvider } from "@/store/auth";
import { requestVariationSchedule } from "@/lib/mutations/admin/repayments";
import {
  getVariationState,
  previewVariation,
  variationAction,
  variationStateKey,
  variationFilterLabels,
  suggestEmailCorrection,
  type VariationFilter,
  type VariationBatch,
  type VariationPreview,
} from "@/lib/payroll/variations";
import { MonthPicker } from "./month-picker";
import { VariationRows } from "./variation-rows";

const formatPeriod = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .toUpperCase();
};
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

export default function RequestVariationSchedule({
  role,
}: {
  role: "ADMIN" | "SUPER_ADMIN";
}) {
  const superAdmin = role === "SUPER_ADMIN";
  const client = useQueryClient();
  const { user } = useUserProvider();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  // Defaulting to the signed-in admin avoids hand-typing an address whose
  // typos only surface later as a silent bounce.
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailTouched, setEmailTouched] = useState(false);
  const suggestion = suggestEmailCorrection(email);
  const [mode, setMode] = useState<"DRAFT" | "SUBMIT">("DRAFT");
  const [changeFilter, setChangeFilter] = useState<VariationFilter>("ALL");
  const previewRequest = useRef(0);
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [preview, setPreview] = useState<VariationPreview | null>(null);
  const [baseline, setBaseline] = useState("");
  const [reference, setReference] = useState("");
  const [discardReason, setDiscardReason] = useState("");
  const [error, setError] = useState("");
  const history = useQuery({
    queryKey: variationStateKey,
    queryFn: getVariationState,
    retry: 1,
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const generation = useMutation(requestVariationSchedule);
  const calculation = useMutation({ mutationFn: previewVariation });
  const action = useMutation({ mutationFn: variationAction });
  const busy =
    generation.isPending || calculation.isPending || action.isPending;
  const state = history.data;

  // The profile loads after first render, so seed the field once it arrives
  // unless the operator has already typed their own address.
  useEffect(() => {
    if (!emailTouched && user?.email) setEmail(user.email);
  }, [user?.email, emailTouched]);

  function invalidatePreview() {
    previewRequest.current += 1;
    setPreview(null);
    setAcknowledged(false);
  }

  async function runAction(path: string, data: Record<string, unknown>) {
    setError("");
    try {
      const result = await action.mutateAsync({ path, data });
      toast.success(result.message);
      invalidatePreview();
      await client.invalidateQueries({ queryKey: variationStateKey });
      return true;
    } catch (failure) {
      setError(errorMessage(failure));
      return false;
    }
  }
  async function refreshPreview() {
    if (!month) return;
    setError("");
    invalidatePreview();
    const requestId = previewRequest.current;
    try {
      const result = await calculation.mutateAsync({
        period: formatPeriod(month),
        changeFilter,
      });
      if (requestId === previewRequest.current) setPreview(result);
    } catch (failure) {
      if (requestId === previewRequest.current) {
        setError(errorMessage(failure));
        await history.refetch();
      }
    }
  }
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) {
      await refreshPreview();
      return;
    }
    if (
      preview.issues.length ||
      (!preview.rows.length && preview.changeFilter !== "ALL") ||
      (mode === "SUBMIT" && !acknowledged)
    )
      return;
    setError("");
    try {
      await generation.mutateAsync({
        period: preview.period,
        email,
        mode,
        previewHash: preview.previewHash,
        changeFilter: preview.changeFilter,
        ...(mode === "SUBMIT" ? { submissionNote: note.trim() } : {}),
      });
      invalidatePreview();
      await client.invalidateQueries({ queryKey: variationStateKey });
    } catch (failure) {
      setError(errorMessage(failure));
      invalidatePreview();
      await history.refetch();
    }
  }

  function savedBatch(batch: VariationBatch, pending = false) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {batch.status === "DISCARDED"
              ? "Discarded"
              : batch.kind === "NO_CHANGES"
                ? "No changes"
                : batch.status === "PREPARED"
                  ? "Awaiting submission"
                  : batch.status === "SENT"
                    ? "Submitted"
                    : "Draft"}
          </Badge>
          <span className="text-xs text-muted-foreground">{batch.id}</span>
        </div>
        {batch.changeFilter && (
          <p className="text-sm">
            Included: {variationFilterLabels[batch.changeFilter]}
          </p>
        )}
        {batch.excludedCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {batch.excludedCount} other customer changes were excluded when this
            file was prepared. Review All changes to see what still awaits
            submission.
          </p>
        )}
        {batch.note && <p className="text-sm">{batch.note}</p>}
        {batch.submissionReference && (
          <p className="text-sm">Reference: {batch.submissionReference}</p>
        )}
        {batch.discardedAt && batch.discardReason && (
          <p className="text-sm text-muted-foreground">
            Discarded: {batch.discardReason}
          </p>
        )}
        <VariationRows rows={batch.rows} />
        {batch.emailError ? (
          <p className="text-sm text-red-700" role="alert">
            {batch.emailError}
          </p>
        ) : batch.emailDeliveredAt ? (
          <p className="text-xs text-green-700">
            Delivered to {batch.recipientEmail}. This is separate from
            submitting it for payroll.
          </p>
        ) : batch.emailedAt ? (
          <p className="text-xs text-muted-foreground">
            Sent to {batch.recipientEmail} — awaiting delivery confirmation.
            This is separate from submitting it for payroll.
          </p>
        ) : batch.rows.length > 0 && batch.kind !== "BASELINE" ? (
          <p className="text-xs text-muted-foreground">
            File is being prepared for email. Status refreshes automatically.
          </p>
        ) : null}
        {batch.rows.length > 0 && batch.kind !== "BASELINE" && (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(`${batch.id}/email`, { email });
            }}
          >
            <Input
              aria-label="Email address for saved variation"
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmailTouched(true);
                setEmail(event.target.value);
              }}
              placeholder={batch.recipientEmail ?? "payroll@example.com"}
              className="min-w-48 flex-1"
            />
            <Button type="submit" variant="outline" disabled={busy}>
              Email saved copy
            </Button>
            {suggestion && (
              <p className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                <span>
                  That domain looks misspelled. Did you mean{" "}
                  <strong>{suggestion}</strong>?
                </span>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => setEmail(suggestion)}
                >
                  Use it
                </button>
              </p>
            )}
          </form>
        )}
        {pending && (
          <p className="text-sm text-muted-foreground">
            Submit this exact official file for payroll, then confirm below.
            Resolve this submission before preparing another variation.
          </p>
        )}
        {pending && superAdmin && (
          <form
            className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await runAction(`${batch.id}/sent`, {
                  reference: reference.trim(),
                })
              )
                setReference("");
            }}
          >
            <Label htmlFor="variation-submission-reference">
              Submission reference
            </Label>
            <Input
              id="variation-submission-reference"
              required
              maxLength={1000}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Dispatch reference, receipt or email subject and date"
            />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" required className="mt-1" />I confirm this
              exact file has been submitted.
            </label>
            <Button
              type="submit"
              disabled={
                busy ||
                !batch.artifactHash ||
                !batch.emailedAt ||
                !!batch.emailError ||
                !reference.trim()
              }
            >
              Confirm submitted
            </Button>
            {batch.emailError && (
              <p className="text-xs text-red-700">
                Correct the address and email the saved copy again before
                confirming this submission.
              </p>
            )}
          </form>
        )}
        {pending && superAdmin && (
          <form
            className="space-y-3 rounded-lg border p-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await runAction(`${batch.id}/discard`, {
                  reason: discardReason.trim(),
                })
              )
                setDiscardReason("");
            }}
          >
            <Label htmlFor="variation-discard-reason">
              Discard this preparation instead
            </Label>
            <p className="text-xs text-muted-foreground">
              Use this if the file was never submitted — a wrong address, or a
              mistake. It reopens {batch.period} so deductions can change again
              and a corrected variation can be prepared. Changes already applied
              elsewhere keep the month they were scheduled for.
            </p>
            <Input
              id="variation-discard-reason"
              required
              maxLength={1000}
              value={discardReason}
              onChange={(event) => setDiscardReason(event.target.value)}
              placeholder="Why is this preparation being abandoned?"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={busy || !discardReason.trim()}
            >
              Discard and reopen {batch.period}
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        setError("");
        invalidatePreview();
        setReference("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-10 w-full border-red-200 bg-white px-4 font-normal text-[#8f0909] hover:bg-red-50 sm:w-auto"
        >
          <FileSpreadsheet />
          Schedule Variation
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92dvh] grid-cols-1 w-[calc(100%-1.5rem)] max-w-4xl sm:max-w-4xl gap-0 overflow-y-auto p-0 sm:w-full"
      >
        <DialogHeader className="border-b px-5 py-5 pr-12">
          <DialogTitle>Monthly variation</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-5 p-5">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {history.isPending ? (
            <p role="status">Loading submission history…</p>
          ) : history.isError ? (
            <div role="alert">
              <p>{errorMessage(history.error)}</p>
              <Button variant="outline" onClick={() => void history.refetch()}>
                Retry
              </Button>
            </div>
          ) : !state?.initialized ? (
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  await runAction("initialize", {
                    ...(baseline === "NONE"
                      ? { noPriorInstructions: true }
                      : { scheduleId: baseline }),
                    reference: reference.trim(),
                  })
                )
                  setReference("");
              }}
            >
              <div className="space-y-2">
                <h3 className="font-medium">
                  Confirm the last submitted schedule
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select the last complete schedule actually submitted. It will
                  be used to identify changes without resending existing names.
                </p>
              </div>
              {superAdmin ? (
                <>
                  <Label htmlFor="variation-baseline">
                    Previously sent schedule
                  </Label>
                  <select
                    id="variation-baseline"
                    required
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={baseline}
                    onChange={(event) => setBaseline(event.target.value)}
                  >
                    <option value="">Select a confirmed submission</option>
                    {state?.legacySchedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.period} · version {schedule.version} ·{" "}
                        {schedule.rowCount} customers · {schedule.id}
                      </option>
                    ))}
                    <option value="NONE">
                      No loan deduction instructions have ever been submitted
                    </option>
                  </select>
                  <Label htmlFor="baseline-reference">
                    Reference or explanation
                  </Label>
                  <Input
                    id="baseline-reference"
                    required
                    maxLength={1000}
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Reference for the last submitted schedule"
                  />
                  <label className="flex items-start gap-2 text-sm">
                    <input required type="checkbox" className="mt-1" />I confirm
                    this accurately represents the instructions already
                    submitted.
                  </label>
                  <Button
                    type="submit"
                    disabled={busy || !baseline || !reference.trim()}
                  >
                    Save submission baseline
                  </Button>
                </>
              ) : (
                <p className="rounded-lg bg-amber-50 p-3 text-sm">
                  A super admin must confirm the last submitted schedule before
                  variations can be generated.
                </p>
              )}
            </form>
          ) : state.pending ? (
            <section className="space-y-3">
              <h3 className="font-medium">
                {state.pending.period} · prepared variation
              </h3>
              {savedBatch(state.pending, true)}
            </section>
          ) : (
            <form onSubmit={generate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Payroll month</Label>
                  <MonthPicker
                    value={month}
                    onChange={(value) => {
                      setMonth(value);
                      invalidatePreview();
                    }}
                    viewYear={viewYear}
                    onViewYearChange={setViewYear}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variation-email">Email the file to</Label>
                  <Input
                    id="variation-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmailTouched(true);
                      setEmail(event.target.value);
                    }}
                    placeholder="payroll@example.com"
                  />
                  {suggestion && (
                    <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                      <span>
                        That domain looks misspelled. Did you mean{" "}
                        <strong>{suggestion}</strong>?
                      </span>
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={() => setEmail(suggestion)}
                      >
                        Use it
                      </button>
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="variation-change-filter">
                  Customer changes to include
                </Label>
                <select
                  id="variation-change-filter"
                  className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
                  value={changeFilter}
                  disabled={busy}
                  onChange={(event) => {
                    setChangeFilter(event.target.value as VariationFilter);
                    invalidatePreview();
                  }}
                >
                  {Object.entries(variationFilterLabels).map(
                    ([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  {changeFilter === "COMBINED"
                    ? "Includes only customers with all three unsubmitted changes: a disbursed top-up, an applied liquidation and an approved tenure change."
                    : "Selects customers by their unsubmitted effective changes. Each selected customer keeps one final instruction covering all their changes."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="variation-mode">Generation type</Label>
                <select
                  id="variation-mode"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value as "DRAFT" | "SUBMIT");
                    setAcknowledged(false);
                  }}
                >
                  <option value="DRAFT">Draft for review</option>
                  {superAdmin && (
                    <option value="SUBMIT">Prepare official variation</option>
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  {mode === "DRAFT"
                    ? "A draft does not freeze deductions or mark changes as sent."
                    : "Preparing freezes this month's deductions. New loan reviews then apply to the next open month. Confirm separately after submitting the file."}
                </p>
              </div>
              {mode === "SUBMIT" && (
                <div className="space-y-2">
                  <Label htmlFor="variation-note">Preparation reason</Label>
                  <Textarea
                    id="variation-note"
                    required
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Reason for preparing this month's variation"
                  />
                </div>
              )}
              {preview && (
                <section className="space-y-3" aria-label="Variation preview">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {preview.counts.start} start
                    </Badge>
                    <Badge variant="outline">
                      {preview.counts.amend} amend
                    </Badge>
                    <Badge variant="outline">{preview.counts.stop} stop</Badge>
                    <Badge variant="secondary">
                      {preview.unchangedCount} unchanged, excluded
                    </Badge>
                  </div>
                  <p className="text-sm" role="status">
                    {preview.rows.length} customer
                    {preview.rows.length === 1 ? "" : "s"} selected ·{" "}
                    {preview.excludedCount} other customer changes awaiting
                    submission
                  </p>
                  {preview.rows.length === 0 &&
                  preview.changeFilter !== "ALL" ? (
                    <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                      <p>
                        No customers match this filter. Select All changes to
                        review the month.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setChangeFilter("ALL");
                          invalidatePreview();
                        }}
                      >
                        Show all changes
                      </Button>
                    </div>
                  ) : (
                    <VariationRows rows={preview.rows} />
                  )}
                  {preview.excludedCount > 0 && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                      The excluded customers will stay available for another
                      variation. Confirming this file marks only its included
                      instructions as sent.
                    </p>
                  )}
                  {!!preview.issues.length && (
                    <div
                      role="alert"
                      className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm"
                    >
                      <p className="font-medium">
                        Resolve these issues before generating:
                      </p>
                      <ul className="list-disc pl-5">
                        {preview.issues.map((issue, index) => (
                          <li key={`${issue.borrowerId}-${index}`}>
                            {issue.name}: {issue.message}
                          </li>
                        ))}
                      </ul>
                      {superAdmin &&
                        preview.issues.some((issue) =>
                          issue.message.includes("backfill"),
                        ) && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void runAction("backfill", {
                                period: preview.period,
                              })
                            }
                          >
                            Initialize missing legacy repayment plans
                          </Button>
                        )}
                    </div>
                  )}
                  {mode === "SUBMIT" &&
                    !preview.issues.length &&
                    (preview.rows.length > 0 ||
                      preview.changeFilter === "ALL") && (
                      <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={acknowledged}
                          onChange={(event) =>
                            setAcknowledged(event.target.checked)
                          }
                          className="mt-1"
                        />
                        {preview.rows.length
                          ? "I have reviewed these customer instructions and want to prepare this exact official file."
                          : "I have reviewed this month and want to finalize it with no changes to send."}
                      </label>
                    )}
                </section>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {preview && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void refreshPreview()}
                  >
                    <RefreshCw className="size-4" />
                    Refresh preview
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    !month ||
                    !!preview?.issues.length ||
                    (!!preview &&
                      !preview.rows.length &&
                      preview.changeFilter !== "ALL") ||
                    (!!preview &&
                      mode === "SUBMIT" &&
                      (!acknowledged || !note.trim()))
                  }
                >
                  {busy
                    ? "Working…"
                    : !preview
                      ? "Preview changes"
                      : !preview.rows.length && preview.changeFilter !== "ALL"
                        ? "No matching customers"
                        : mode === "DRAFT"
                          ? preview.rows.length
                            ? "Save and email draft"
                            : "Save empty draft"
                          : preview.rows.length
                            ? "Prepare and email official file"
                            : "Finalize month — no changes"}
                </Button>
              </div>
            </form>
          )}
          {!!state?.history.length && (
            <section className="space-y-2 border-t pt-4">
              <h3 className="font-medium">Saved variations</h3>
              <p className="text-xs text-muted-foreground">
                Re-emailing a saved file preserves its original instructions.
              </p>
              {state.history
                .filter((batch) => batch.id !== state.pending?.id)
                .map((batch) => (
                  <details key={batch.id} className="rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm">
                      {batch.period} · version {batch.version} ·{" "}
                      {batch.kind === "BASELINE"
                        ? "Confirmed baseline"
                        : batch.kind === "NO_CHANGES"
                          ? "No changes"
                          : batch.status}{" "}
                      · {batch.rows.length} customers
                    </summary>
                    <div className="mt-3">{savedBatch(batch)}</div>
                  </details>
                ))}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
