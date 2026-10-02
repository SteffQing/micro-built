"use client";

import { Icon, icons, type IconData } from "@/components/icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type VariationMode = "DRAFT" | "SUBMIT";

type VariationModeOptionProps = {
  value: VariationMode;
  selected: boolean;
  icon: IconData;
  title: string;
  description: string;
  warning?: boolean;
};

export function VariationModeOption({
  value,
  selected,
  icon,
  title,
  description,
  warning = false,
}: VariationModeOptionProps) {
  return (
    <Label
      htmlFor={`variation-mode-${value.toLowerCase()}`}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
        selected && !warning && "border-blue-300 bg-blue-50/60",
        selected && warning && "border-amber-300 bg-amber-50/70",
        !selected && "hover:bg-muted/40",
      )}
    >
      <RadioGroupItem
        id={`variation-mode-${value.toLowerCase()}`}
        value={value}
        className="mt-0.5"
      />
      <span className="space-y-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icon icon={icon} size={16} />
          {title}
        </span>
        <span className="block text-xs font-normal leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </Label>
  );
}

type OfficialSubmissionReviewProps = {
  period: string;
  email: string;
  submissionNote: string;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
};

export function OfficialSubmissionReview({
  period,
  email,
  submissionNote,
  acknowledged,
  onAcknowledgedChange,
}: OfficialSubmissionReviewProps) {
  return (
    <div className="space-y-5 px-5 py-5 sm:px-6">
      <Alert className="border-amber-200 bg-amber-50 text-amber-950">
        <Icon icon={icons.lock} size={16} />
        <AlertTitle>Review official payroll submission</AlertTitle>
        <AlertDescription className="text-amber-900/80">
          This becomes the payroll instruction for {period}.
        </AlertDescription>
      </Alert>

      <div className="overflow-hidden rounded-lg border bg-muted/20">
        <ReviewRow icon={icons.calendarDays} label="Payroll period" value={period} />
        <Separator />
        <ReviewRow icon={icons.mail} label="Delivery email" value={email} />
        <Separator />
        <ReviewRow
          icon={icons.shield}
          label="Submission reference"
          value={submissionNote}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30">
        <Checkbox
          checked={acknowledged}
          onCheckedChange={(checked) =>
            onAcknowledgedChange(checked === true)
          }
          className="mt-0.5"
        />
        <span className="text-sm leading-5 text-muted-foreground">
          I confirm these submission details are correct.
        </span>
      </label>
    </div>
  );
}

type ReviewRowProps = {
  icon: IconData;
  label: string;
  value: string;
};

function ReviewRow({ icon, label, value }: ReviewRowProps) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 px-4 py-3">
      <Icon icon={icon} size={16} className="mt-0.5 text-muted-foreground" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
