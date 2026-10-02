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

type RateField = "interestRate" | "managementFeeRate" | "penaltyRate" | "maxDeductionRate";

const rateLabels: Record<RateField, { label: string; title: string; min: number; max: number }> = {
  interestRate: { label: "Interest Rate", title: "Interest Rate", min: 0, max: 100 },
  managementFeeRate: { label: "Management Fee", title: "Management Fee Rate", min: 0, max: 100 },
  penaltyRate: { label: "Default Charge Rate", title: "Default Charge Rate", min: 0, max: 100 },
  maxDeductionRate: { label: "Max Deduction Rate", title: "Max Deduction Rate", min: 1, max: 100 },
};

export default function LoanConfigurationCard({
  interestRate,
  managementFeeRate,
  penaltyRate,
  maxDeductionRate,
}: {
  interestRate: number | null;
  managementFeeRate: number | null;
  penaltyRate: number | null;
  maxDeductionRate: number | null;
}) {
  return (
    <div className="p-3 lg:p-5 flex flex-col gap-8">
      {(
        [
          ["interestRate", interestRate],
          ["managementFeeRate", managementFeeRate],
          ["penaltyRate", penaltyRate],
          ["maxDeductionRate", maxDeductionRate],
        ] as [RateField, number | null][]
      ).map(([field, value]) => (
        <div key={field} className="flex flex-col gap-3">
          <Label className="text-muted-foreground font-normal text-sm">
            {rateLabels[field].label}
          </Label>
          <EditConfig field={field} value={value} />
        </div>
      ))}
    </div>
  );
}

function EditConfig({ field, value }: { field: RateField; value: number | null }) {
  const config = rateLabels[field];
  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState(value ?? 0);
  const { mutateAsync, isPending } = useMutation(updateRate);

  async function updateConfigRate() {
    const patch: Partial<UpdateRateDto> = {};
    if (field === "maxDeductionRate") {
      // maxDeductionRate can be set to null to disable
      patch[field] = newValue || null;
    } else {
      patch[field] = newValue;
    }
    await mutateAsync(patch as UpdateRateDto);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="w-full cursor-pointer">
          <Input
            value={value === null || value === undefined ? "Not set" : `${value}%`}
            readOnly
            className="bg-muted py-3 px-5 rounded-xl cursor-pointer"
          />
        </div>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {config.title}</DialogTitle>
        </DialogHeader>
        <Separator className="bg-border" />
        <div className="grid gap-4 p-4 sm:p-5">
          <NumericalInput
            value={newValue}
            onValueChange={setNewValue}
            min={config.min}
            max={config.max}
            step={0.1}
            maxDecimals={2}
          />

          <Separator className="bg-border" />
        </div>
        <DialogFooter>
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
            disabled={(newValue < config.min || newValue > config.max) || isPending}
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
