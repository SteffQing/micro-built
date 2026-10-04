"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { closeRepaymentPeriod } from "@/lib/mutations/admin/repayments";
import { useUserProvider } from "@/store/auth";

type Step = "form" | "confirm";

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export default function CloseRepaymentPeriod() {
  const { userRole } = useUserProvider();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [period, setPeriod] = useState("");
  const { mutateAsync, isPending, reset } = useMutation(closeRepaymentPeriod);

  const isValidPeriod = PERIOD_PATTERN.test(period.trim());

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep("form");
      setPeriod("");
      reset();
    }
    setOpen(nextOpen);
  };

  const handleConfirm = async () => {
    await mutateAsync({ period: period.trim() });
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
          className="h-10 border-destructive/40 bg-card px-4 font-normal text-brand hover:bg-destructive/5 hover:text-brand"
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
          <section className="space-y-5 p-4 sm:p-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Enter the repayment period you want to close, in{" "}
              <span className="font-semibold">YYYY-MM</span> format, for example{" "}
              <span className="font-semibold">2026-06</span>.
            </div>

            <div className="space-y-2">
              <Label htmlFor="repayment-period">Repayment Period</Label>
              <Input
                id="repayment-period"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                placeholder="2026-06"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-wrap gap-2">
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
          <section className="space-y-5 p-4 sm:p-5">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-red-700">
                <Icon icon={icons.shieldAlert} size={16} />
                <span className="font-semibold">Final confirmation</span>
              </div>
              <p className="text-sm text-red-900">
                This prevents new entries or uploads for repayments for{" "}
                <span className="font-semibold">{period.trim()}</span> and
                earlier periods. Please double-check the period before you
                confirm.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Icon icon={icons.alertTriangle} size={16} className="text-amber-500" />
                Period to close
              </div>
              <p className="font-semibold">{period.trim()}</p>
            </div>

            <div className="flex flex-wrap gap-2">
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
                className="flex-1 bg-brand text-brand-foreground hover:bg-brand/90"
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
