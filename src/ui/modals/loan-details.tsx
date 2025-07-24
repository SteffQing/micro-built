"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";

interface LoanDetailsDisplayProps {
  loan: Loan;
  isEditable?: boolean;
  onLoanTenureChange?: (value: number) => void;
}

export function LoanDetailsDisplay({ loan, isEditable = false, onLoanTenureChange }: LoanDetailsDisplayProps) {
  const formatPercentage = (rate: number) => `${(rate * 100).toFixed(0)}%`;

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 items-center gap-4">
        <Label className="text-muted-foreground">Customer ID</Label>
        <span className="text-right font-medium">{loan.borrowerId}</span>
      </div>
      <div className="grid grid-cols-2 items-center gap-4">
        <Label className="text-muted-foreground">Loan Type</Label>
        <span className="text-right font-medium">{loan.category}</span>
      </div>
      <div className="grid grid-cols-2 items-center gap-4">
        <Label className="text-muted-foreground">Loan Amount</Label>
        <span className="text-right font-medium">{formatCurrency(loan.amount)}</span>
      </div>
      <div className="grid grid-cols-2 items-center gap-4">
        <Label className="text-muted-foreground">Interest per Annum (%)</Label>

        <span className="text-right font-medium">{formatPercentage(loan.interestRate)}</span>
      </div>
      <div className="grid grid-cols-2 items-center gap-4">
        <Label className="text-muted-foreground">Management Fee Rate (%)</Label>

        <span className="text-right font-medium">{formatPercentage(loan.managementFeeRate)}</span>
      </div>
      <div className="grid grid-cols-2 items-center gap-4">
        <Label className="text-muted-foreground">Loan Tenure</Label>
        {isEditable ? (
          <Input
            type="number"
            value={loan.loanTenure}
            onChange={(e) => onLoanTenureChange?.(Number.parseFloat(e.target.value))}
            className="text-right"
          />
        ) : (
          <span className="text-right font-medium">{loan.loanTenure} Months</span>
        )}
      </div>
      {/* Additional details for full display when not editable */}
      {!isEditable && (
        <>
          <div className="grid grid-cols-2 items-center gap-4">
            <Label className="text-muted-foreground">Amount Repayable</Label>
            <span className="text-right font-medium">{formatCurrency(loan.amountRepayable)}</span>
          </div>
          <div className="grid grid-cols-2 items-center gap-4">
            <Label className="text-muted-foreground">Amount Repaid</Label>
            <span className="text-right font-medium">{formatCurrency(loan.amountRepaid)}</span>
          </div>
          {loan.disbursementDate && (
            <div className="grid grid-cols-2 items-center gap-4">
              <Label className="text-muted-foreground">Disbursement Date</Label>
              <span className="text-right font-medium">{formatDate(loan.disbursementDate, "PPP")}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
