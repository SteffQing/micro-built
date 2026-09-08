"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestVariationSchedule } from "@/lib/mutations/admin/repayments";
import {
  getVariationState,
  previewVariation,
  variationAction,
  variationStateKey,
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
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"DRAFT" | "SUBMIT">("DRAFT");
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [preview, setPreview] = useState<VariationPreview | null>(null);
  const [baseline, setBaseline] = useState("");
  const [reference, setReference] = useState("");
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

  async function runAction(path: string, data: Record<string, unknown>) {
    setError("");
    try {
      const result = await action.mutateAsync({ path, data });
      toast.success(result.message);
      setPreview(null);
      setAcknowledged(false);
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
    setPreview(null);
    setAcknowledged(false);
    try {
      setPreview(await calculation.mutateAsync(formatPeriod(month)));
    } catch (failure) {
      setError(errorMessage(failure));
      await history.refetch();
    }
  }
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) {
      await refreshPreview();
      return;
    }
    if (preview.issues.length || (mode === "SUBMIT" && !acknowledged)) return;
    setError("");
    try {
      await generation.mutateAsync({
        period: preview.period,
        email,
        mode,
        previewHash: preview.previewHash,
        ...(mode === "SUBMIT" ? { submissionNote: note.trim() } : {}),
      });
      setPreview(null);
      setAcknowledged(false);
      await client.invalidateQueries({ queryKey: variationStateKey });
    } catch (failure) {
      setError(errorMessage(failure));
      setPreview(null);
      setAcknowledged(false);
      await history.refetch();
    }
  }

  function savedBatch(batch: VariationBatch, pending = false) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {batch.kind === "NO_CHANGES"
              ? "No changes"
              : batch.status === "PREPARED"
                ? "Awaiting FG submission"
                : batch.status === "SENT"
                  ? "Sent to FG"
                  : "Draft"}
          </Badge>
          <span className="text-xs text-muted-foreground">{batch.id}</span>
        </div>
        {batch.note && <p className="text-sm">{batch.note}</p>}
        {batch.submissionReference && (
          <p className="text-sm">Reference: {batch.submissionReference}</p>
        )}
        <VariationRows rows={batch.rows} />
        {batch.emailError ? (
          <p className="text-sm text-red-700">
            File delivery failed: {batch.emailError}. Email the saved copy to
            retry.
          </p>
        ) : batch.emailedAt ? (
          <p className="text-xs text-muted-foreground">
            File emailed. This is separate from sending it to FG.
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
              onChange={(event) => setEmail(event.target.value)}
              placeholder={batch.recipientEmail ?? "payroll@example.com"}
              className="min-w-48 flex-1"
            />
            <Button type="submit" variant="outline" disabled={busy}>
              Email saved copy
            </Button>
          </form>
        )}
        {pending && (
          <p className="text-sm text-muted-foreground">
            Send this exact official file to FG, then confirm below. Resolve
            this submission before preparing another variation.
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
            <Label htmlFor="fg-submission-reference">
              FG submission reference
            </Label>
            <Input
              id="fg-submission-reference"
              required
              maxLength={1000}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Dispatch reference, receipt or email subject and date"
            />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" required className="mt-1" />I confirm this
              exact file has been sent to FG.
            </label>
            <Button
              type="submit"
              disabled={
                busy ||
                !batch.artifactHash ||
                !batch.emailedAt ||
                !reference.trim()
              }
            >
              Confirm sent to FG
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
        setPreview(null);
        setAcknowledged(false);
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
      <DialogContent className="max-h-[92dvh] grid-cols-1 w-[calc(100%-1.5rem)] max-w-4xl sm:max-w-4xl gap-0 overflow-y-auto p-0 sm:w-full">
        <DialogHeader className="border-b px-5 py-5 pr-12">
          <DialogTitle>Monthly payroll variation</DialogTitle>
          <DialogDescription>
            Send new or changed deductions to FG. Each customer appears once,
            with their final instruction for the month.
          </DialogDescription>
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
                <h3 className="font-medium">Confirm what FG already has</h3>
                <p className="text-sm text-muted-foreground">
                  Select the last complete schedule actually sent to FG. It will
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
                      No loan deduction instructions have ever been sent to FG
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
                    placeholder="Reference for the schedule FG received"
                  />
                  <label className="flex items-start gap-2 text-sm">
                    <input required type="checkbox" className="mt-1" />I confirm
                    this accurately represents the instructions already sent to
                    FG.
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
                  A super admin must confirm the existing FG submission before
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
                      setPreview(null);
                      setAcknowledged(false);
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
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="payroll@example.com"
                  />
                </div>
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
                    : "Preparing freezes this month's deductions. New loan reviews then apply to the next open month. Confirm separately after sending the file to FG."}
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
                  <VariationRows rows={preview.rows} />
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
                  {mode === "SUBMIT" && !preview.issues.length && (
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
                      mode === "SUBMIT" &&
                      (!acknowledged || !note.trim()))
                  }
                >
                  {busy
                    ? "Working…"
                    : !preview
                      ? "Preview changes"
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
