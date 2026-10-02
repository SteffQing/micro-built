"use client";

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
import { updateRate } from "@/lib/mutations/admin/superadmin";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

export default function LoanConfigurationCard({
  interestRate,
  managementFeeRate,
  penaltyFeeRate,
}: Pick<ConfigData, "interestRate" | "managementFeeRate" | "penaltyFeeRate">) {
  return (
    <div className="p-3 lg:p-5 flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Label
          htmlFor="interest-rate"
          className="text-muted-foreground font-normal text-sm"
        >
          Interest Rate
        </Label>
        <EditConfig rateKey="INTEREST_RATE" value={interestRate} />
      </div>

      <div className="flex flex-col gap-3">
        <Label
          htmlFor="management-fee"
          className="text-muted-foreground font-normal text-sm"
        >
          Management Fee
        </Label>
        <EditConfig rateKey="MANAGEMENT_FEE_RATE" value={managementFeeRate} />
      </div>

      <div className="flex flex-col gap-3">
        <Label
          htmlFor="penalty-fee"
          className="text-muted-foreground font-normal text-sm"
        >
          Penalty Fee
        </Label>
        <EditConfig rateKey="PENALTY_FEE_RATE" value={penaltyFeeRate} />
      </div>
    </div>
  );
}

function EditConfig({
  rateKey,
  value,
}: Omit<UpdateRateDto & { rateKey: UpdateRateDto["key"] }, "key">) {
  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState(value);
  const { mutateAsync, isPending } = useMutation(updateRate);

  async function updateConfigRate() {
    await mutateAsync({ key: rateKey, value: newValue });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="w-full cursor-pointer">
          <Input
            value={value}
            readOnly
            className="bg-muted py-3 px-5 rounded-xl cursor-pointer"
          />
        </div>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Update{" "}
            {rateKey === "INTEREST_RATE"
              ? "Interest Rate"
              : rateKey === "MANAGEMENT_FEE_RATE"
              ? "Management Fee Rate"
              : "Penalty Fee Rate"}
          </DialogTitle>
        </DialogHeader>
        <Separator className="bg-border" />
        <div className="grid gap-4 p-4 sm:p-5">
          <NumericalInput
            value={newValue}
            onValueChange={setNewValue}
            min={0}
            max={100}
            step={0.1}
            maxDecimals={2}
          />

          <Separator className="bg-border" />
        </div>
        <DialogFooter>
          {" "}
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={updateConfigRate}
            disabled={newValue < 0 || newValue > 100 || isPending}
            loading={isPending}
            className="rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm flex-1 btn-gradient"
          >
            Update Rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
