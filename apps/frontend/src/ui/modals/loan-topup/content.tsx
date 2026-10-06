import type { Dispatch, SetStateAction } from "react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoanCategory } from "@/config/enums";
import { cn, formatRole } from "@/lib/utils";
import { CommodityDropdown, CashInput } from "../request-loan/dropdown-input";
import type {
  CommodityDropdownProps,
  CashInputProps,
} from "../request-loan/dropdown-input";
import { Checkbox } from "@/components/ui/checkbox";
import { LoanIcons } from "@/components/svg/loan";
import { NumericalInput } from "@/components/ui/numerical-input";

export interface RequestModalContentHeaderProps {
  step: number;
}
function RequestModalContentHeader({ step }: RequestModalContentHeaderProps) {
  return (
    <div className="flex gap-4 justify-between items-center">
      <div className="flex gap-3.5 flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
            step !== 1
              ? "border-2 border-dashed border-destructive text-destructive"
              : "btn-gradient text-primary-foreground"
          )}
        >
          1
        </div>
        <p
          className={cn(
            "text-sm",
            step === 1
              ? "text-brand font-medium"
              : "text-muted-foreground font-normal"
          )}
        >
          Loan Details
        </p>
      </div>
      <div className="flex gap-3.5 flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
            step !== 2
              ? "border-2 border-dashed border-destructive text-destructive"
              : "btn-gradient text-primary-foreground"
          )}
        >
          2
        </div>

        <p
          className={cn(
            "text-sm",
            step === 2
              ? "text-brand font-medium"
              : "text-muted-foreground font-normal"
          )}
        >
          Confirmation
        </p>
      </div>
    </div>
  );
}

export interface RequestModalContentProps
  extends CashInputProps,
    CommodityDropdownProps {
  category: LoanCategory | null;
  setCategory: Dispatch<SetStateAction<LoanCategory | null>>;
  tenure: number;
  setTenure: Dispatch<SetStateAction<number>>;
}
function RequestModalContent(props: RequestModalContentProps) {
  function handleCategoryChange(newCategory: LoanCategory) {
    if (
      props.category === LoanCategory.ASSET_PURCHASE &&
      newCategory !== LoanCategory.ASSET_PURCHASE
    ) {
      props.setCommodity("");
    } else if (
      props.category !== LoanCategory.ASSET_PURCHASE &&
      newCategory === LoanCategory.ASSET_PURCHASE
    ) {
      props.setAmount(0);
    }

    props.setCategory(newCategory);
  }
  return (
    <>
      <Separator className="bg-border" />
      <p className="text-sm text-foreground font-normal">
        Please provide the information below before proceeding
      </p>
      <div className="flex flex-col gap-3 w-full">
        <Label className="text-sm font-medium">Financing Category</Label>
        <Select
          onValueChange={(value) => handleCategoryChange(value as LoanCategory)}
        >
          <SelectTrigger className="w-full" aria-label="Financing category">
            <SelectValue placeholder="Select Loan Type" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(LoanCategory).map((type) => (
              <SelectItem value={type} key={type}>
                {formatRole(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {props.category === LoanCategory.ASSET_PURCHASE ? (
        <>
          <CommodityDropdown
            commodity={props.commodity}
            setCommodity={props.setCommodity}
          />
          <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            This creates a new asset-financing advance on the customer&apos;s running loan, charged at that loan&apos;s rates. The amount and any tenure change are set during asset review and only affect payroll after disbursement.
          </p>
        </>
      ) : (
        <CashInput amount={props.amount} setAmount={props.setAmount} />
      )}

      {props.category !== LoanCategory.ASSET_PURCHASE && (
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium">Top-up Tenure</Label>
          <NumericalInput
            value={props.tenure}
            onValueChange={props.setTenure}
            emptyOnZero
            min={1}
            max={120}
            step={1}
            maxDecimals={0}
          aria-label="Loan tenure in months"
          />
        </div>
      )}
    </>
  );
}

export interface RequestModalContentConfirmationProps {
  checked: boolean;
  setChecked: Dispatch<SetStateAction<boolean>>;
  /** The running loan's rates (percent): what the top-up is charged. Undefined while loading. */
  rates?: { interestRate: number; managementFeeRate: number };
}
function RequestModalContentConfirmation({
  checked,
  setChecked,
  rates,
}: RequestModalContentConfirmationProps) {
  return (
    <>
      <Separator className="bg-border" />
      <dl className="grid gap-1.5 rounded-md border bg-muted p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Interest (monthly)</dt>
          <dd className="font-semibold">{rates ? `${rates.interestRate}%` : "…"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Management fee</dt>
          <dd className="font-semibold">{rates ? `${rates.managementFeeRate}%` : "…"}</dd>
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          The running loan&apos;s rates, not today&apos;s settings.
        </p>
      </dl>
      <div className="flex flex-col gap-3">
        <h3 className="text-foreground font-medium text-base">
          Are you sure you want to proceed?
        </h3>
        <p className="text-muted-foreground font-normal text-sm">
          Ensure that your details are correct before submission. You can go
          back to edit if need
        </p>
      </div>
      <Separator className="bg-border" />
      <div className="flex flex-wrap gap-2">
        <Checkbox
          id="confirmation"
          checked={checked}
          onCheckedChange={(checked) => setChecked(checked === true)}
        />
        <Label
          htmlFor="confirmation"
          className="text-muted-foreground font-normal text-sm"
        >
          I confirm that the details above are accurate and I agree to the terms
          and conditions.
        </Label>
      </div>
    </>
  );
}

function RequestModalContentSuccess() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center">
        <LoanIcons.successful_application />
      </div>
      <h2 className="text-foreground font-semibold text-xl">
        Top-up Request Submitted
      </h2>
      <p className="text-muted-foreground font-normal text-sm">
        The top-up request was recorded successfully. It will not change the customer&apos;s repayment obligation until the approved advance is disbursed.
      </p>
    </div>
  );
}

export {
  RequestModalContent,
  RequestModalContentHeader,
  RequestModalContentConfirmation,
  RequestModalContentSuccess,
};
