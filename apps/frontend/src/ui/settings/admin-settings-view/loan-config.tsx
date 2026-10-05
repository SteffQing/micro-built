"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Icon, icons } from "@/components/icon";
import { SettingRow } from "./setting-row";
import { NumericalInput } from "@/components/ui/numerical-input";
import { Label } from "@/components/ui/label";
import { updateRate } from "@/lib/mutations/admin/superadmin";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

type RateField = "interestRate" | "managementFeeRate" | "penaltyRate" | "maxDeductionRate";

const rateLabels: Record<
  RateField,
  { label: string; title: string; description: string; min: number; max: number }
> = {
  interestRate: {
    label: "Interest Rate",
    title: "Interest Rate",
    description: "Interest applied to new loans.",
    min: 0,
    max: 100,
  },
  managementFeeRate: {
    label: "Management Fee",
    title: "Management Fee Rate",
    description: "Charged on the loan principal.",
    min: 0,
    max: 100,
  },
  penaltyRate: {
    label: "Default Charge",
    title: "Default Charge Rate",
    description: "Charged on any shortfall when a period closes.",
    min: 0,
    max: 100,
  },
  maxDeductionRate: {
    label: "Max Deduction",
    title: "Max Deduction Rate",
    description: "Cap on a deduction as a share of net pay.",
    min: 1,
    max: 100,
  },
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
  const rows = [
    ["interestRate", interestRate],
    ["managementFeeRate", managementFeeRate],
    ["penaltyRate", penaltyRate],
    ["maxDeductionRate", maxDeductionRate],
  ] as [RateField, number | null][];

  return (
    <div className="divide-y">
      {rows.map(([field, value]) => (
        <SettingRow key={field} title={rateLabels[field].label} description={rateLabels[field].description}>
          <div className="flex items-center gap-3">
            <span
              className={`min-w-14 text-right text-lg font-semibold tabular-nums ${value == null ? "text-sm font-normal text-muted-foreground" : ""}`}
            >
              {value == null ? "Not set" : `${value}%`}
            </span>
            <EditConfig field={field} value={value} />
          </div>
        </SettingRow>
      ))}
    </div>
  );
}

function EditConfig({ field, value }: { field: RateField; value: number | null }) {
  const config = rateLabels[field];
  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState(value ?? 0);
  const { mutateAsync, isPending } = useMutation(updateRate);
  const inputId = `rate-${field}`;
  const invalid = newValue < config.min || newValue > config.max;

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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setNewValue(value ?? 0);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Edit ${config.label}`}>
          <Icon icon={icons.edit} size={14} />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <div className={dialogBodyClass}>
          <div className="space-y-2">
            <Label htmlFor={inputId}>New rate</Label>
            <div className="relative">
              <NumericalInput
                id={inputId}
                value={newValue}
                onValueChange={setNewValue}
                min={config.min}
                max={config.max}
                step={0.1}
                maxDecimals={2}
                aria-invalid={invalid}
                className="pr-8 text-base tabular-nums"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Current: {value == null ? "not set" : `${value}%`} · Allowed {config.min}–{config.max}%
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={updateConfigRate} disabled={invalid || isPending} loading={isPending}>
            Update rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
