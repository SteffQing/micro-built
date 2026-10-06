import type { Dispatch, SetStateAction } from "react";
import { Icon, icons } from "@/components/icon";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoanCategory } from "@/config/enums";
import { cn, formatCurrency } from "@/lib/utils";
import { CommodityDropdown, CashInput } from "./dropdown-input";
import type { CommodityDropdownProps, CashInputProps } from "./dropdown-input";
import { Checkbox } from "@/components/ui/checkbox";
import { LoanIcons } from "@/components/svg/loan";
import { getConfig } from "@/lib/queries/config";
import { useQuery } from "@tanstack/react-query";
import { userLoanOverview } from "@/lib/queries/user/loan";

export interface RequestModalContentHeaderProps {
  step: number;
  topup?: boolean;
}
function RequestModalContentHeader({ step, topup }: RequestModalContentHeaderProps) {
  return (
    <div className="flex gap-4 justify-between items-center">
      <div className="flex gap-3.5 flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
            step !== 1 ? "border-2 border-dashed border-destructive text-destructive" : "btn-gradient text-primary-foreground",
          )}
        >
          1
        </div>
        <p className={cn("text-sm", step === 1 ? "text-brand font-medium" : "text-muted-foreground font-normal")}>
          {topup ? "Top-up Details" : "Loan Details"}
        </p>
      </div>
      <div className="flex gap-3.5 flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
            step !== 2 ? "border-2 border-dashed border-destructive text-destructive" : "btn-gradient text-primary-foreground",
          )}
        >
          2
        </div>

        <p className={cn("text-sm", step === 2 ? "text-brand font-medium" : "text-muted-foreground font-normal")}>
          Confirmation
        </p>
      </div>
    </div>
  );
}

export interface RequestModalContentProps extends CashInputProps, CommodityDropdownProps {
  category: LoanCategory | null;
  setCategory: Dispatch<SetStateAction<LoanCategory | null>>;
  /** A top-up on the running loan: cash or an asset, no loan type (the loan already has one). */
  topup?: boolean;
}
function RequestModalContent(props: RequestModalContentProps) {
  function handleCategoryChange(newCategory: LoanCategory) {
    if (props.category === LoanCategory.ASSET_PURCHASE && newCategory !== LoanCategory.ASSET_PURCHASE) {
      props.setCommodity("");
    } else if (props.category !== LoanCategory.ASSET_PURCHASE && newCategory === LoanCategory.ASSET_PURCHASE) {
      props.setAmount(0);
    }

    props.setCategory(newCategory);
  }
  return (
    <>
      <Separator className="bg-border" />
      <p className="text-sm text-foreground font-normal">Please provide the information below before proceeding</p>
      {props.topup ? (
        <div className="flex flex-col gap-3 w-full">
          <Label className="text-sm font-medium">Top-up Type</Label>
          <Select
            defaultValue="CASH"
            onValueChange={(value) => {
              // Cash leaves the category empty: a top-up takes the running loan's.
              if (value === "ASSET") {
                props.setAmount(0);
                props.setCategory(LoanCategory.ASSET_PURCHASE);
              } else {
                props.setCommodity("");
                props.setCategory(null);
              }
            }}
          >
            <SelectTrigger className="w-full" aria-label="Top-up type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="ASSET">Asset</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          <Label className="text-sm font-medium">Loan Type</Label>
          <Select onValueChange={(value) => handleCategoryChange(value as LoanCategory)}>
            <SelectTrigger className="w-full" aria-label="Loan type">
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
      )}
      {props.category === LoanCategory.ASSET_PURCHASE ? (
        <CommodityDropdown commodity={props.commodity} setCommodity={props.setCommodity} />
      ) : (
        <CashInput amount={props.amount} setAmount={props.setAmount} />
      )}
    </>
  );
}

export interface RequestModalContentConfirmationProps {
  checked: boolean;
  setChecked: Dispatch<SetStateAction<boolean>>;
  amount: number;
  category: LoanCategory | null;
  commodity: string;
  topup?: boolean;
}
function RequestModalContentConfirmation({
  checked,
  setChecked,
  amount,
  category,
  commodity,
  topup,
}: RequestModalContentConfirmationProps) {
  const { data: config, isLoading: configLoading } = useQuery(getConfig);
  // A top-up is charged its running loan's rates, not today's Settings (penalties always follow Settings).
  const { data: overview, isLoading: overviewLoading } = useQuery({ ...userLoanOverview, enabled: !!topup });
  const running = topup ? overview?.data?.runningLoanRates : null;
  const isLoading = configLoading || (!!topup && overviewLoading);
  // A rate that isn't configured yet reads as 0%, not "undefined%".
  const pct = (value: number | null | undefined) => `${value ?? 0}%`;
  const rows: [string, React.ReactNode][] = [
    [category === LoanCategory.ASSET_PURCHASE ? "Asset" : topup ? "Top-up amount" : "Amount", category === LoanCategory.ASSET_PURCHASE ? commodity : formatCurrency(amount)],
    ["Interest (monthly)", pct(running ? running.interestRate : config?.data?.interestRate)],
    ["Management fee (one-time)", pct(running ? running.managementFeeRate : config?.data?.managementFeeRate)],
    ["Penalty on default", pct(config?.data?.penaltyFeeRate)],
  ];

  return (
    <div className="grid min-w-0 gap-4">
      <dl className="grid gap-1.5 rounded-md border bg-muted p-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right font-semibold text-foreground wrap-anywhere">
              {isLoading && label !== rows[0][0] ? (
                <Icon icon={icons.loaderCircle} size={16} className="animate-spin text-primary" />
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {running && (
        <p className="-mt-2 text-xs text-muted-foreground">
          A top-up is charged your current loan&apos;s interest and fee rates.
        </p>
      )}
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="confirmation"
          className="mt-0.5 shrink-0"
          checked={checked}
          onCheckedChange={(next) => setChecked(next === true)}
        />
        <Label htmlFor="confirmation" className="text-sm leading-snug font-normal text-muted-foreground">
          These details are correct, and I agree to the terms and conditions.
        </Label>
      </div>
    </div>
  );
}

function RequestModalContentSuccess({ topup }: { topup?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center">
        <LoanIcons.successful_application />
      </div>
      <h2 className="text-foreground font-semibold text-xl">Application Submitted Successfully</h2>
      <p className="text-muted-foreground font-normal text-sm">
        We have received your {topup ? "top-up" : "loan"} request. You will be notified once it is reviewed by our team{" "}
      </p>
    </div>
  );
}

export { RequestModalContent, RequestModalContentHeader, RequestModalContentConfirmation, RequestModalContentSuccess };
