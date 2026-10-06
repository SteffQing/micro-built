"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";

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
import { NumericalInput } from "@/components/ui/numerical-input";
import { requestCustomerTenureChange } from "@/lib/mutations/admin/customer";
import { getUserActiveLoan } from "@/lib/queries/admin/customer";
import { cn } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";

type Props = {
  borrowerId: string;
  trigger?: ReactNode;
};

const LIMIT = 120;
const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;

export default function TenureChangeModal({ borrowerId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [monthsDelta, setMonthsDelta] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const { userRole } = useUserProvider();
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const { data } = useQuery({ ...getUserActiveLoan(borrowerId), enabled: open });
  const remaining = data?.data?.remainingMonths ?? null;
  const after = remaining === null ? null : remaining + monthsDelta;
  // A loan can be shortened to one month at most.
  const tooShort = after !== null && after < 1;

  const requestMutation = useMutation(requestCustomerTenureChange(borrowerId));

  useEffect(() => {
    if (!open) {
      setMonthsDelta(0);
      setSubmitted(false);
    }
  }, [open]);

  async function submitRequest() {
    if (monthsDelta === 0 || tooShort) return;
    await requestMutation.mutateAsync({
      monthsDelta,
      ...(isSuperAdmin ? { apply: true } : {}),
    });
    setSubmitted(true);
  }

  const step = (by: number) => setMonthsDelta((d) => Math.max(-LIMIT, Math.min(LIMIT, d + by)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Change tenure</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon={icons.calendarClock} size={20} className="text-brand" />
            Change repayment tenure
          </DialogTitle>
          {!submitted && (
            <DialogDescription>
              Lengthen the running loan to lower the monthly deduction, or shorten it to raise it.
            </DialogDescription>
          )}
        </DialogHeader>

        {submitted ? (
          <div className="grid gap-3 p-6 text-center">
            <Icon icon={icons.checkCircle} size={40} className="mx-auto text-success" />
            <p className="font-medium">{isSuperAdmin ? "Tenure changed" : "Tenure change submitted"}</p>
            <p className="text-sm text-muted-foreground">
              {isSuperAdmin
                ? "The tenure change has been applied."
                : "A super admin must approve it. Until then, the current repayment plan stays as it is."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 px-4 pb-2 sm:px-5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="One month fewer"
                onClick={() => step(-1)}
                disabled={monthsDelta <= -LIMIT}
              >
                <Icon icon={icons.minus} size={16} />
              </Button>
              <NumericalInput
                id="months-delta"
                aria-label="Months to add, negative to shorten"
                min={-LIMIT}
                max={LIMIT}
                step={1}
                maxDecimals={0}
                value={monthsDelta}
                emptyOnZero
                placeholder="0"
                className="text-center text-lg font-semibold tabular-nums"
                onValueChange={(value) => setMonthsDelta(value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="One month more"
                onClick={() => step(1)}
                disabled={monthsDelta >= LIMIT}
              >
                <Icon icon={icons.plus} size={16} />
              </Button>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border bg-muted/40 p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Months left now</p>
                <p className="text-base font-semibold tabular-nums">{remaining === null ? "—" : remaining}</p>
              </div>
              <Icon icon={icons.arrowRight} size={16} className="text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">After the change</p>
                <p
                  className={cn(
                    "text-base font-semibold tabular-nums",
                    tooShort ? "text-destructive" : monthsDelta !== 0 && "text-brand"
                  )}
                >
                  {after === null ? "—" : after}
                </p>
              </div>
            </div>
            <p className={cn("text-xs", tooShort ? "text-destructive" : "text-muted-foreground")}>
              {tooShort
                ? "The loan needs at least one month left."
                : monthsDelta === 0
                  ? "Use + to lengthen the loan or − to shorten it."
                  : `${monthsDelta > 0 ? "Adds" : "Removes"} ${months(Math.abs(monthsDelta))}.`}
            </p>
          </div>
        )}

        <DialogFooter>
          {submitted ? (
            <Button className="w-full" onClick={() => setOpen(false)}>
              Done
            </Button>
          ) : (
            <Button
              className="w-full btn-gradient"
              disabled={monthsDelta === 0 || tooShort || requestMutation.isPending}
              loading={requestMutation.isPending}
              onClick={submitRequest}
            >
              {isSuperAdmin ? "Apply tenure change" : "Submit for approval"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
