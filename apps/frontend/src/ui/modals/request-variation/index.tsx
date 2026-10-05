"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Icon, icons } from "@/components/icon";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProvider } from "@/store/auth";
import {
  requestVariationSchedule,
  submitVariationSchedule,
} from "@/lib/mutations/admin/repayments";
import {
  getVariationFile,
  getVariationPreview,
  suggestEmailCorrection,
  variationPreviewKey,
  type VariationAction,
} from "@/lib/payroll/variations";
import { cn } from "@/lib/utils";
import { MonthPicker } from "./month-picker";
import {
  VariationRows,
  VariationRowsSkeleton,
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

const formatDay = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));

const filters: { value: VariationAction | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "START", label: "Start" },
  { value: "AMEND", label: "Amend" },
  { value: "STOP", label: "Stop" },
];

export default function RequestVariationSchedule({
  role,
}: {
  role: "ADMIN" | "SUPER_ADMIN";
}) {
  const superAdmin = role === "SUPER_ADMIN";
  const { user } = useUserProvider();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const [viewYear, setViewYear] = useState(() =>
    Number(currentMonth().slice(0, 4)),
  );
  const [action, setAction] = useState<VariationAction | "ALL">("ALL");
  // Defaulting to the signed-in admin avoids hand-typing an address whose
  // typos only surface later as a silent bounce.
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? user?.email ?? "";
  const suggestion = suggestEmailCorrection(email);
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");

  const actionFilter = action === "ALL" ? undefined : action;
  const preview = useQuery({
    queryKey: variationPreviewKey(month, { action: actionFilter }),
    queryFn: () => getVariationPreview(month, { action: actionFilter }),
    enabled: open && Boolean(month),
    retry: 1,
  });
  const generation = useMutation(requestVariationSchedule);
  const submission = useMutation(submitVariationSchedule);
  const download = useMutation({ mutationFn: getVariationFile });
  const busy =
    generation.isPending || submission.isPending || download.isPending;

  const data = preview.data;
  const period = data?.period;
  const submitted = Boolean(period?.submittedAt);
  const closed = Boolean(period?.closedAt);

  function resetTransient() {
    setConfirming(false);
    setAcknowledged(false);
    setError("");
  }

  function changeMonth(next: string) {
    setMonth(next);
    resetTransient();
  }

  async function sendDraft() {
    setError("");
    try {
      await generation.mutateAsync({
        period: month,
        email: email.trim() || undefined,
      });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function submit() {
    setError("");
    try {
      await submission.mutateAsync({ period: month });
      resetTransient();
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function downloadFile() {
    setError("");
    try {
      const file = await download.mutateAsync(month);
      window.open(file.url, "_blank", "noopener,noreferrer");
    } catch (failure) {
      setError(errorMessage(failure));
      toast.error("Could not open the file");
    }
  }

  const shownError =
    error || (preview.isError ? errorMessage(preview.error) : "");

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
          <DialogTitle>Monthly variation</DialogTitle>
          <DialogDescription>
            The deduction changes payroll must apply for a month.
          </DialogDescription>
        </DialogHeader>
        <div className={cn(dialogBodyClass, "min-w-0 pt-4")}>
          {shownError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {shownError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label>Payroll month</Label>
              <MonthPicker
                value={month}
                onChange={changeMonth}
                viewYear={viewYear}
                onViewYearChange={setViewYear}
              />
            </div>
            <div className="flex h-9 items-center">
              {!period ? (
                <Skeleton className="h-6 w-24" />
              ) : closed ? (
                <Badge variant="outline">Closed</Badge>
              ) : submitted ? (
                <Badge
                  variant="outline"
                  className="border-transparent bg-success/12 text-success"
                >
                  Submitted {formatDay(period.submittedAt!)}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-transparent bg-warning/12 text-warning"
                >
                  Open
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2" aria-label="Change counts">
            {(["START", "AMEND", "STOP"] as const).map((key) => (
              <div
                key={key}
                className={cn("rounded-lg p-3 text-center", actionTone[key])}
              >
                {data ? (
                  <p className="text-xl font-semibold">{data.counts[key]}</p>
                ) : (
                  <Skeleton className="mx-auto h-7 w-8" />
                )}
                <p className="text-xs">{actionLabels[key]}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <div
              role="group"
              aria-label="Filter by action"
              className="flex flex-wrap gap-1.5"
            >
              {filters.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  size="sm"
                  variant={action === f.value ? "default" : "outline"}
                  aria-pressed={action === f.value}
                  onClick={() => setAction(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            {preview.isLoading ? (
              <VariationRowsSkeleton />
            ) : data ? (
              <VariationRows rows={data.rows} />
            ) : null}
          </div>

          {data && !submitted && (
            <div className="grid gap-1.5">
              <Label htmlFor="variation-email">Email the draft to</Label>
              <Input
                id="variation-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setTypedEmail(e.target.value);
                }}
              />
              {suggestion && (
                <p className="text-xs text-warning">
                  Did you mean{" "}
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() => {
                      setTypedEmail(suggestion);
                    }}
                  >
                    {suggestion}
                  </button>
                  ?
                </p>
              )}
            </div>
          )}

          {superAdmin && data && !submitted && !closed && confirming && (
            <div className="grid gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <p>
                Submitting sends {data.period.label} to payroll, freezes the
                deductions at these amounts and opens the next month. It
                cannot be undone, and months go in order.
              </p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="variation-ack"
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                />
                <Label htmlFor="variation-ack" className="font-normal">
                  I have reviewed the changes for {data.period.label}.
                </Label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={resetTransient}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!acknowledged || busy}
                  onClick={submit}
                >
                  {submission.isPending ? "Submitting…" : "Confirm submit"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {submitted ? (
              <Button
                type="button"
                disabled={busy || !period?.hasFile}
                onClick={downloadFile}
              >
                <Icon icon={icons.download} size={16} />
                {download.isPending ? "Opening…" : "Download file"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !data || !email.trim()}
                  onClick={sendDraft}
                >
                  <Icon icon={icons.mail} size={16} />
                  {generation.isPending ? "Sending…" : "Email draft"}
                </Button>
                {superAdmin && (
                  <Button
                    type="button"
                    disabled={busy || !data || closed || confirming}
                    onClick={() => setConfirming(true)}
                  >
                    Submit variation
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
