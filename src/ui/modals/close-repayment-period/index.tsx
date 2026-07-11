"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { closeRepaymentPeriod } from "@/lib/mutations/admin/repayments";
import { useUserProvider } from "@/store/auth";

type Step = "form" | "confirm";

const PERIOD_PATTERN =
  /^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s\d{4}$/;

export default function CloseRepaymentPeriod() {
  const { userRole } = useUserProvider();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [period, setPeriod] = useState("");
  const { mutateAsync, isPending, reset } = useMutation(closeRepaymentPeriod);

  const normalizedPeriod = useMemo(() => period.trim().toUpperCase(), [period]);
  const isValidPeriod = PERIOD_PATTERN.test(normalizedPeriod);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep("form");
      setPeriod("");
      reset();
    }
    setOpen(nextOpen);
  };

  const handleConfirm = async () => {
    await mutateAsync({ period: normalizedPeriod });
    handleOpenChange(false);
  };

  if (userRole !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-10 border-[#ffb5b5] bg-white px-4 font-normal text-[#a10b0b] hover:bg-red-50 hover:text-[#a10b0b]"
        >
          Close Period
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%_-_1.5rem)] max-w-lg px-4 py-4 sm:px-6">
        <DialogHeader>
          <DialogTitle>
            {step === "form" ? "Close Repayment Period" : "Confirm Period Closure"}
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <section className="space-y-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Enter the repayment period you want to close, for example{" "}
              <span className="font-semibold">JUNE 2026</span>.
            </div>

            <div className="space-y-2">
              <Label htmlFor="repayment-period">Repayment Period</Label>
              <Input
                id="repayment-period"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                placeholder="JUNE 2026"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 btn-gradient"
                disabled={!isValidPeriod}
                onClick={() => setStep("confirm")}
              >
                Continue
              </Button>
            </div>
          </section>
        ) : (
          <section className="space-y-5">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-red-700">
                <ShieldAlert className="h-4 w-4" />
                <span className="font-semibold">Final confirmation</span>
              </div>
              <p className="text-sm text-red-900">
                This prevents new entries or uploads for repayments for{" "}
                <span className="font-semibold">{normalizedPeriod}</span> and
                earlier periods. Please double-check the period before you
                confirm.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Period to close
              </div>
              <p className="font-semibold">{normalizedPeriod}</p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={() => setStep("form")}
              >
                Back
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#a10b0b] text-white hover:bg-[#8b0b0b]"
                loading={isPending}
                onClick={handleConfirm}
              >
                Confirm Close
              </Button>
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
