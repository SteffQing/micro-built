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
import { cn } from "@/lib/utils";
import { CommodityDropdown, CashInput } from "../request-loan/dropdown-input";
import type {
  CommodityDropdownProps,
  CashInputProps,
} from "../request-loan/dropdown-input";
import { Checkbox } from "@/components/ui/checkbox";
import { LoanIcons } from "@/components/svg/loan";

export interface RequestModalContentHeaderProps {
  step: number;
}
function RequestModalContentHeader({ step }: RequestModalContentHeaderProps) {
  return (
    <div className="grid grid-cols-3 gap-4 justify-between items-center">
      <div className="flex gap-3.5 flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
            step !== 1
              ? "border-2 border-dashed border-red-800 text-red-800"
              : "btn-gradient text-primary-foreground"
          )}
        >
          1
        </div>
        <p
          className={cn(
            "text-sm",
            step === 1
              ? "text-[#8A0806] font-medium"
              : "text-muted-foreground font-normal"
          )}
        >
          Customer Details
        </p>
      </div>
      <div className="flex gap-3.5 flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
            step !== 2
              ? "border-2 border-dashed border-red-800 text-red-800"
              : "btn-gradient text-primary-foreground"
          )}
        >
          2
        </div>

        <p
          className={cn(
            "text-sm",
            step === 2
              ? "text-[#8A0806] font-medium"
              : "text-muted-foreground font-normal"
          )}
        >
          Identity Info
        </p>
      </div>

      <div className="flex gap-3.5 flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
            step !== 3
              ? "border-2 border-dashed border-red-800 text-red-800"
              : "btn-gradient text-primary-foreground"
          )}
        >
          3
        </div>

        <p
          className={cn(
            "text-sm",
            step === 3
              ? "text-[#8A0806] font-medium"
              : "text-muted-foreground font-normal"
          )}
        >
          Payroll Info
        </p>
      </div>
      <div className="flex gap-3.5 flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
            step !== 4
              ? "border-2 border-dashed border-red-800 text-red-800"
              : "btn-gradient text-primary-foreground"
          )}
        >
          4
        </div>

        <p
          className={cn(
            "text-sm",
            step === 4
              ? "text-[#8A0806] font-medium"
              : "text-muted-foreground font-normal"
          )}
        >
          Payment Info
        </p>
      </div>

      <div className="flex gap-3.5 flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
            step !== 5
              ? "border-2 border-dashed border-red-800 text-red-800"
              : "btn-gradient text-primary-foreground"
          )}
        >
          5
        </div>

        <p
          className={cn(
            "text-sm",
            step === 5
              ? "text-[#8A0806] font-medium"
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
            step !== 6
              ? "border-2 border-dashed border-red-800 text-red-800"
              : "btn-gradient text-primary-foreground"
          )}
        >
          6
        </div>

        <p
          className={cn(
            "text-sm",
            step === 6
              ? "text-[#8A0806] font-medium"
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
      <Separator className="bg-[#F0F0F0]" />
      <p className="text-sm text-[#666666] font-normal">
        Please provide the information below before proceeding
      </p>
      <div className="flex flex-col gap-3 w-full">
        <Label className="text-sm font-medium">Loan Type</Label>
        <Select
          onValueChange={(value) => handleCategoryChange(value as LoanCategory)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Loan Type" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(LoanCategory).map((type) => (
              <SelectItem value={type} key={type}>
                {type
                  .toLowerCase()
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (char) => char.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {props.category === LoanCategory.ASSET_PURCHASE ? (
        <CommodityDropdown
          commodity={props.commodity}
          setCommodity={props.setCommodity}
        />
      ) : (
        <CashInput amount={props.amount} setAmount={props.setAmount} />
      )}
    </>
  );
}

export interface RequestModalContentConfirmationProps {
  checked: boolean;
  setChecked: Dispatch<SetStateAction<boolean>>;
}
function RequestModalContentConfirmation({
  checked,
  setChecked,
}: RequestModalContentConfirmationProps) {
  return (
    <>
      <Separator className="bg-[#F0F0F0]" />
      <div className="flex flex-col gap-3">
        <h3 className="text-[#333333] font-medium text-base">
          Are you sure you want to proceed?
        </h3>
        <p className="text-[#999999] font-normal text-sm">
          Ensure that your details are correct before submission. You can go
          back to edit if need
        </p>
      </div>
      <Separator className="bg-[#F0F0F0]" />
      <div className="flex gap-3">
        <Checkbox
          id="confirmation"
          checked={checked}
          onCheckedChange={(checked) => setChecked(checked === true)}
        />
        <Label
          htmlFor="confirmation"
          className="text-[#999999] font-normal text-sm"
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
      <h2 className="text-[#333333] font-semibold text-xl">
        Customer Uploaded Successfully
      </h2>
      <p className="text-[#999999] font-normal text-sm">
        The customer details have been successfully uploaded to the system.
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
