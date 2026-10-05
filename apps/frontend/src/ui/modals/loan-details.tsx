"use client";

import { NumericalInput } from "@/components/ui/numerical-input";
import { Separator } from "@/components/ui/separator";
import { getTotalPayment } from "@/config/logic";
import { getUserActiveLoan } from "@/lib/queries/admin/customer";
import { cn, formatCurrency, formatRole } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "date-fns";

interface LoanDetailsDisplayProps {
  loan: CashLoan | UserCashLoan;
  isEditable?: boolean;
  onTenureChange?: (value: number) => void;
  cName?: string;
}

interface AdminLoanDetailsDisplayProps {
  loan: CashLoan;
  kind?: "NEW_LOAN" | "TOPUP";
  isEditable?: boolean;
  onChange?: (value: number) => void;
}

export function LoanDetailsDisplay({
  loan,
  isEditable = false,
  onTenureChange,
  ...props
}: LoanDetailsDisplayProps) {
  const Component =
    "borrower" in loan ? (
      <CashLoanDetailsDisplay isEditable={isEditable} onTenureChange={onTenureChange} loan={loan} {...props} />
    ) : (
      <UserCashLoanDetailsDisplay loan={loan as UserCashLoan} {...props} />
    );

  return Component;
}

interface CashLoanDetailsDisplayProps extends LoanDetailsDisplayProps {
  loan: CashLoan;
}
interface Props {
  title: string;
  content: string;
}
function Detail({ title, content }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="shrink-0 text-sm text-muted-foreground">{title}</p>
      <p className="min-w-0 text-right text-sm font-medium text-foreground [overflow-wrap:anywhere]">{content}</p>
    </div>
  );
}

function AdminLoanDetailsDisplay({ loan, kind, isEditable, onChange }: AdminLoanDetailsDisplayProps) {
  const { data } = useQuery({
    ...getUserActiveLoan(loan.borrower.id),
    enabled: isEditable,
  });

  const total = getTotalPayment(loan.principal, loan.interestRate, loan.tenure);
  // Once disbursed, interest is what the ledger booked (an asset's price can include it, an import brings its
  // own); before that it is an estimate from the rate and tenure.
  const booked = !["PENDING", "APPROVED", "REJECTED"].includes(loan.status) && typeof loan.interestBooked === "number";
  const interest = booked ? loan.interestBooked : total - loan.principal;
  const rate = typeof loan.interestRate === "number" ? ` · ${loan.interestRate}% a month` : "";

  const lastLoanRequest = data?.data;
  return (
    <>
      <Separator className="bg-border" />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Loan Information</h3>
        <div className="grid gap-2">
          <Detail title="Loan Type" content={formatRole(loan.category)} />
          <Detail title="Advance Type" content={kind === "TOPUP" ? "Top-up" : "Initial advance"} />
          {loan.assets && loan.assets.length > 0 && (
            <>
              <Detail title="Asset" content={loan.assets[0].name} />
              <Detail title="Asset Request ID" content={loan.assets[0].id} />
            </>
          )}
          <Detail title="Loan Amount" content={formatCurrency(loan.principal)} />
          <Detail
            title={booked ? "Interest booked" : "Interest (estimate)"}
            content={`${formatCurrency(interest)}${rate}`}
          />
          <Detail title="Penalty Accrued" content={formatCurrency(loan.penaltyBooked ?? 0)} />

        </div>
      </div>

      <Separator className="bg-border" />
      <div className="grid gap-2">
        {isEditable ? (
          <>
            <div className="flex flex-col gap-2">
              {lastLoanRequest && (
                <p className="text-xs text-foreground leading-relaxed">
                  {" "}
                  This remains a separate top-up advance and will be{" "}
                  <strong>added to the running loan</strong>. <br /> Current outstanding:{" "}
                  <strong>{formatCurrency(lastLoanRequest.outstanding)}</strong>{" "}
                </p>
              )}
              <p className="text-foreground text-sm font-normal">Loan Tenure</p>

              <div className="flex flex-col gap-1">
                <NumericalInput
                  value={loan.tenure}
                  onValueChange={(value) => onChange?.(value)}
                  emptyOnZero
                  min={1}
                  max={120}
                  step={1}
                  maxDecimals={0}
                  className="border border-border bg-muted rounded-[8px] p-4 sm:p-5 text-foreground text-sm font-medium placeholder:text-foreground placeholder:text-sm placeholder:font-medium"
                />

                <span className="text-muted-foreground text-xs font-normal">
                  New consolidated tenure:{" "}
                  {Math.max(lastLoanRequest?.remainingMonths ?? 0, loan.tenure || 0)} months
                </span>
                {lastLoanRequest && loan.tenure > 0 && (
                  <span className="text-muted-foreground text-xs font-normal">
                    Estimated consolidated balance:{" "}
                    {formatCurrency(lastLoanRequest.outstanding + total)}. Estimated monthly:{" "}
                    {formatCurrency(
                      (lastLoanRequest.outstanding + total) /
                        Math.max(lastLoanRequest.remainingMonths, loan.tenure),
                    )}
                    . Final values are committed by the backend at disbursement.
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <Detail title="Loan Tenure" content={loan.tenure + " Months"} />
            <Detail
              title="Total repayable"
              content={formatCurrency(booked ? loan.owed : loan.principal + interest)}
            />
            <Detail title="Repaid" content={formatCurrency(loan.repaid ?? 0)} />
            {booked && <Detail title="Outstanding" content={formatCurrency(loan.outstanding ?? 0)} />}
            {loan.disbursementDate && (
              <Detail title="Disbursement Date" content={formatDate(loan.disbursementDate, "PPP")} />
            )}
            <Detail title="Status" content={loan.status} />
          </>
        )}
      </div>

      <Separator className="bg-border" />
    </>
  );
}

export function CashLoanDetailsDisplay({ loan, isEditable, onTenureChange, cName }: CashLoanDetailsDisplayProps) {
  return (
    <div className={cn("grid gap-4 p-4 sm:p-5", cName)}>
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Customer Information</h3>
        <div className="grid gap-2 bg-muted p-4 rounded-lg border border-border">
          <Detail title="Borrower Name" content={loan.borrower.name} />
          <Detail title="IPPIS ID" content={loan.borrower.externalId ?? ""} />
          <Detail title="Contact Info" content={loan.borrower.phoneNumber ?? loan.borrower.email ?? ""} />
        </div>
      </div>

      <AdminLoanDetailsDisplay loan={loan} isEditable={isEditable} onChange={onTenureChange} />
    </div>
  );
}

export function UserCashLoanDetailsDisplay({ loan, cName }: { loan: UserCashLoan; cName?: string }) {
  return (
    <div className={cn("grid gap-4 p-4 sm:p-5", cName)}>
      <Detail title="Loan ID" content={loan.id} />
      <Detail title="Loan Type" content={loan.category} />
      <Detail title="Loan Amount" content={formatCurrency(loan.principal)} />
      <Detail title="Amount Repayable" content={formatCurrency(loan.owed)} />
      <Detail title="Amount Repaid" content={formatCurrency(loan.repaid)} />
      {loan.tenure > 0 && <Detail title="Loan Tenure" content={loan.tenure + " Months"} />}
      {loan.assetName && <Detail title="Asset Name" content={loan.assetName} />}
      {loan.disbursementDate && <Detail title="Disbursement Date" content={formatDate(loan.disbursementDate, "PPP")} />}
      <Detail title="Status" content={loan.status} />
      <Separator className="bg-border" />
    </div>
  );
}

/**
 * An asset request and, once priced, its loan. `fullLoan` (the loan as the cash-loan endpoint returns it, with
 * rates and booked figures) replaces the summary embedded in the request when the caller has it.
 */
export function CommodityLoanDetailsDisplay({ loan, fullLoan }: { loan: CommodityLoanDto; fullLoan?: CashLoan | null }) {
  const cash_loan = fullLoan ?? loan.loan;
  return (
    <div className="min-w-0">
      <div className="grid gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Customer Information</h3>
          <div className="grid gap-2 bg-muted p-4 rounded-lg border border-border">
            <Detail title="Borrower Name" content={loan.borrower.name} />
            <Detail title="IPPIS ID" content={loan.borrower.externalId ?? ""} />
            <Detail title="Contact Info" content={loan.borrower.phoneNumber ?? loan.borrower.email ?? ""} />
          </div>
        </div>
        <Detail title="Asset Loan ID" content={loan.id} />
        <Detail title="Advance Type" content={loan.kind === "TOPUP" ? "Top-up" : "Initial advance"} />
        <Detail title="Asset Name" content={loan.name} />
        <Detail title="Request Date" content={formatDate(loan.createdAt, "PPP")} />
        <Detail title="Review Status" content={loan.status === "IN_REVIEW" ? "In Review" : "Reviewed"} />
        {loan.publicDetails && (
          <div className="flex flex-col gap-2">
            <p className="text-foreground text-sm font-normal">Public Details</p>
            <div className="rounded-md bg-muted p-3 text-sm [overflow-wrap:anywhere]">{loan.publicDetails}</div>
          </div>
        )}
        {loan.privateDetails && (
          <div className="flex flex-col gap-2">
            <p className="text-foreground text-sm font-normal">Private Details</p>
            <div className="rounded-md bg-muted p-3 text-sm [overflow-wrap:anywhere]">{loan.privateDetails}</div>
          </div>
        )}

        {cash_loan && (
          <AdminLoanDetailsDisplay loan={{ ...cash_loan, category: "ASSET_PURCHASE", borrower: loan.borrower }} kind={loan.kind} />
        )}
      </div>
    </div>
  );
}
