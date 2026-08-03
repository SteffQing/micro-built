"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumericalInput } from "@/components/ui/numerical-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  previewTenureChange,
  requestTenureChange,
} from "@/lib/mutations/admin/customer";
import { repaymentObligation } from "@/lib/queries/admin/customer";
import { formatCurrency } from "@/lib/utils";

type Props = {
  borrowerId: string;
  trigger?: ReactNode;
};

export default function TenureChangeModal({ borrowerId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [termMonths, setTermMonths] = useState(12);
  const [reasonCode, setReasonCode] = useState("CUSTOMER_AFFORDABILITY");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<TenureChangePreviewDto | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const obligationQuery = useQuery({
    ...repaymentObligation(borrowerId),
    enabled: open,
  });
  const obligation = obligationQuery.data?.data ?? null;
  const previewMutation = useMutation(
    previewTenureChange(obligation?.id ?? "unavailable"),
  );
  const requestMutation = useMutation(
    requestTenureChange(obligation?.id ?? "unavailable", borrowerId),
  );

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setSubmitted(false);
      setNote("");
    }
  }, [open]);

  async function previewChange() {
    if (!obligation || termMonths < 1 || termMonths > 120) return;
    const result = await previewMutation.mutateAsync(termMonths);
    if (result.data) setPreview(result.data);
  }

  async function submitRequest() {
    if (!obligation || !preview || !reasonCode.trim()) return;
    await requestMutation.mutateAsync({
      termMonths: preview.proposedTermMonths,
      reasonCode: reasonCode.trim(),
      note: note.trim() || undefined,
      expectedObligationVersion: preview.obligationVersion,
    });
    setSubmitted(true);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Change tenure</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-[#8A0806]" />
            Change repayment tenure
          </DialogTitle>
        </DialogHeader>
        <Separator />

        {submitted ? (
          <div className="grid gap-3 py-6 text-center">
            <CheckCircle2 className="mx-auto size-10 text-green-600" />
            <p className="font-medium">Tenure change submitted</p>
            <p className="text-sm text-muted-foreground">
              A super admin must approve it. Until then, the published payroll
              schedule and current repayment plan remain unchanged.
            </p>
          </div>
        ) : obligationQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading consolidated obligation…
          </p>
        ) : !obligation || !obligation.currentPlan ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active consolidated repayment plan is available.
          </p>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
              <div>
                <p className="text-muted-foreground">Contract balance</p>
                <p className="font-semibold">
                  {formatCurrency(obligation.contractualOutstanding)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Penalty (not capitalized)</p>
                <p className="font-semibold">
                  {formatCurrency(obligation.penaltyOutstanding)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Current tenure</p>
                <p className="font-semibold">
                  {obligation.currentPlan.termMonths} months
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Current monthly</p>
                <p className="font-semibold">
                  {formatCurrency(obligation.currentPlan.scheduledMonthly)}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-tenure">New remaining tenure (months)</Label>
              <NumericalInput
                id="new-tenure"
                min={1}
                max={120}
                step={1}
                maxDecimals={0}
                value={termMonths}
                emptyOnZero
                onValueChange={(value) => {
                  setTermMonths(value);
                  setPreview(null);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tenure-reason">Reason code</Label>
              <Input
                id="tenure-reason"
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tenure-note">Supporting note</Label>
              <Textarea
                id="tenure-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Customer request, approval reference, or affordability reason"
              />
            </div>

            {preview && (
              <div className="rounded-lg border border-[#FFE1E0] p-4 text-sm">
                <p className="font-medium text-[#8A0806]">Auditable preview</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">New monthly</span>
                  <span className="text-right font-semibold">
                    {formatCurrency(preview.proposedMonthly)}
                  </span>
                  <span className="text-muted-foreground">Effective period</span>
                  <span className="text-right font-semibold">
                    {new Date(preview.effectiveFromPeriod).toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground">New end date</span>
                  <span className="text-right font-semibold">
                    {new Date(preview.endDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {submitted ? (
            <Button className="w-full" onClick={() => setOpen(false)}>
              Done
            </Button>
          ) : preview ? (
            <Button
              className="w-full btn-gradient"
              loading={requestMutation.isPending}
              onClick={submitRequest}
            >
              Submit for approval
            </Button>
          ) : (
            <Button
              className="w-full btn-gradient"
              disabled={!obligation || termMonths < 1 || termMonths > 120}
              loading={previewMutation.isPending}
              onClick={previewChange}
            >
              Preview change
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
