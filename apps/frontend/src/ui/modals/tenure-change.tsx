"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NumericalInput } from "@/components/ui/numerical-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { requestCustomerTenureChange } from "@/lib/mutations/admin/customer";
import { useUserProvider } from "@/store/auth";

type Props = {
  borrowerId: string;
  trigger?: ReactNode;
};

export default function TenureChangeModal({ borrowerId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [monthsDelta, setMonthsDelta] = useState(0);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { userRole } = useUserProvider();
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const requestMutation = useMutation(
    requestCustomerTenureChange(borrowerId),
  );

  useEffect(() => {
    if (!open) {
      setMonthsDelta(0);
      setSubmitted(false);
      setNote("");
    }
  }, [open]);

  async function submitRequest() {
    if (monthsDelta === 0) return;
    await requestMutation.mutateAsync({
      monthsDelta,
      ...(isSuperAdmin ? { apply: true } : {}),
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
            <Icon icon={icons.calendarClock} size={20} className="text-brand" />
            Change repayment tenure
          </DialogTitle>
        </DialogHeader>
        <Separator />

        {submitted ? (
          <div className="grid gap-3 p-6 text-center">
            <Icon icon={icons.checkCircle} size={40} className="mx-auto text-success" />
            <p className="font-medium">Tenure change submitted</p>
            <p className="text-sm text-muted-foreground">
              {isSuperAdmin
                ? "The tenure change has been applied immediately."
                : "A super admin must approve it. Until then, the current repayment plan remains unchanged."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:p-5">
            <div className="grid gap-2">
              <Label htmlFor="months-delta">
                Months to add (negative to shorten)
              </Label>
              <NumericalInput
                id="months-delta"
                min={-120}
                max={120}
                step={1}
                maxDecimals={0}
                value={monthsDelta}
                emptyOnZero
                onValueChange={(value) => {
                  setMonthsDelta(value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Positive values lengthen the loan; negative values shorten it. Cannot be 0.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tenure-note">Supporting note</Label>
              <Textarea
                id="tenure-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Reason for the tenure change"
              />
            </div>
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
              disabled={monthsDelta === 0 || requestMutation.isPending}
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
