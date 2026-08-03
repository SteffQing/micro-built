"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { requestVariationSchedule } from "@/lib/mutations/admin/repayments";
import {
  OfficialSubmissionReview,
  VariationModeOption,
  type VariationMode,
} from "./variation-options";
import { MonthPicker } from "./month-picker";

type Props = {
  role: "ADMIN" | "SUPER_ADMIN";
};

const formatPeriod = (value: string) => {
  if (!value) return "Not selected";

  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .toUpperCase();
};

export default function RequestVariationSchedule({ role }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<VariationMode>("DRAFT");
  const [submissionNote, setSubmissionNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState(false);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const { mutateAsync, isPending, reset } = useMutation(
    requestVariationSchedule,
  );

  const period = useMemo(() => formatPeriod(month), [month]);
  const canSubmit =
    Boolean(month && email) &&
    (mode === "DRAFT" || Boolean(submissionNote.trim()));

  const resetDialog = () => {
    setMonth("");
    setEmail("");
    setMode("DRAFT");
    setSubmissionNote("");
    setAcknowledged(false);
    setReviewingSubmission(false);
    setViewYear(new Date().getFullYear());
    reset();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) return;
    if (nextOpen) resetDialog();
    setOpen(nextOpen);
  };

  const handleModeChange = (value: VariationMode) => {
    setMode(value);
    setAcknowledged(false);
    setReviewingSubmission(false);
  };

  const submitVariation = async () => {
    try {
      await mutateAsync({
        email,
        period,
        mode,
        ...(mode === "SUBMIT" ? { submissionNote: submissionNote.trim() } : {}),
      });
      setOpen(false);
      resetDialog();
    } catch {
      return;
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (mode === "SUBMIT" && !reviewingSubmission) {
      setReviewingSubmission(true);
      return;
    }

    if (mode === "DRAFT" || acknowledged) void submitVariation();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-10 w-full border-red-200 bg-white px-4 font-normal text-[#8f0909] hover:border-red-300 hover:bg-red-50 hover:text-[#8f0909] sm:w-auto"
        >
          <FileSpreadsheet />
          Schedule Variation
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-xl gap-0 overflow-y-auto border-border p-0 sm:w-full">
        <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[#9f0a0a]">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle>Repayment variation</DialogTitle>
              <DialogDescription className="max-w-lg leading-5">
                Generate or submit a monthly payroll schedule.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleFormSubmit}>
          {reviewingSubmission ? (
            <OfficialSubmissionReview
              period={period}
              email={email}
              submissionNote={submissionNote.trim()}
              acknowledged={acknowledged}
              onAcknowledgedChange={setAcknowledged}
            />
          ) : (
            <div className="space-y-6 px-5 py-5 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="variation-period">Payroll month</Label>
                  <MonthPicker
                    value={month}
                    onChange={setMonth}
                    viewYear={viewYear}
                    onViewYearChange={setViewYear}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="variation-email">Send report to</Label>
                  <Input
                    id="variation-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="payroll@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Generation type</Label>
                  {role !== "SUPER_ADMIN" && (
                    <Badge variant="secondary">Draft access</Badge>
                  )}
                </div>

                <RadioGroup
                  value={mode}
                  onValueChange={(value) =>
                    handleModeChange(value as VariationMode)
                  }
                  className={cn(
                    "grid gap-3",
                    role === "SUPER_ADMIN" && "sm:grid-cols-2",
                  )}
                >
                  <VariationModeOption
                    value="DRAFT"
                    selected={mode === "DRAFT"}
                    icon={RefreshCw}
                    title="Review draft"
                    description="Generate a review copy."
                  />
                  {role === "SUPER_ADMIN" && (
                    <VariationModeOption
                      value="SUBMIT"
                      selected={mode === "SUBMIT"}
                      icon={LockKeyhole}
                      title="Official submission"
                      description="Submit payroll with an audit record."
                      warning
                    />
                  )}
                </RadioGroup>
              </div>

              {mode === "SUBMIT" && (
                <div className="space-y-2">
                  <Label htmlFor="submission-note">
                    Submission reason or reference
                  </Label>
                  <Textarea
                    id="submission-note"
                    value={submissionNote}
                    onChange={(event) => setSubmissionNote(event.target.value)}
                    placeholder="Example: Initial August payroll submission"
                    maxLength={300}
                    required
                    className="min-h-24 resize-none"
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {submissionNote.length}/300
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col-reverse border-t bg-muted/20 px-5 py-4 sm:flex-row sm:px-6">
            {reviewingSubmission ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAcknowledged(false);
                    setReviewingSubmission(false);
                  }}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  loading={isPending}
                  disabled={!acknowledged || isPending}
                  className="w-full sm:w-auto"
                >
                  <Send />
                  Submit official variation
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={isPending}
                  disabled={!canSubmit || isPending}
                  className="w-full sm:w-auto"
                >
                  {mode === "DRAFT" ? <FileSpreadsheet /> : <ShieldCheck />}
                  {mode === "DRAFT"
                    ? "Generate review copy"
                    : "Review submission"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
