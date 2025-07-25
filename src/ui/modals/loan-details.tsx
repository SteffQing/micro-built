"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";

interface LoanDetailsDisplayProps {
  loan: CashLoan | UserCashLoan;
  isEditable?: boolean;
  onLoanTenureChange?: (value: number) => void;
}

export function LoanDetailsDisplay({ loan, isEditable = false, onLoanTenureChange }: LoanDetailsDisplayProps) {
  if ("borrowerId" in loan)
    return <CashLoanDetailsDisplay isEditable={isEditable} onLoanTenureChange={onLoanTenureChange} loan={loan} />;
  return <UserCashLoanDetailsDisplay loan={loan as UserCashLoan} />;
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
    <div className="flex justify-between items-center gap-4">
      <p className="text-[#666666] text-sm font-normal">{title}</p>
      <p className="text-[#333333] text-sm font-medium">{content}</p>
    </div>
  );
}

export function CashLoanDetailsDisplay({ loan, isEditable, onLoanTenureChange }: CashLoanDetailsDisplayProps) {
  return (
    <div className="grid gap-4 p-4 sm:p-5">
      <Detail title="Customer ID" content={loan.borrowerId} />
      <Detail title="Loan Type" content={loan.category} />
      <Detail title="Loan Amount" content={formatCurrency(loan.amount)} />
      <Detail title="Interest per Annum (%)" content={loan.interestRate + "%"} />
      <Detail title="Management Fee Rate (%)" content={loan.managementFeeRate + "%"} />
      {isEditable ? (
        <>
          <Separator className="bg-[#F0F0F0]" />
          <div className="flex flex-col gap-3">
            <p className="text-[#666666] text-sm font-normal">Loan Tenure</p>

            <Input
              type="number"
              value={loan.loanTenure}
              onChange={(e) => onLoanTenureChange?.(Number.parseFloat(e.target.value))}
              className="border border-[#F0F0F0] bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 text-[#666666] text-sm font-medium placeholder:text-[#666666] placeholder:text-sm placeholder:font-medium"
            />
          </div>
        </>
      ) : (
        <Detail title="Loan Tenure" content={loan.loanTenure + " Months"} />
      )}

      {!isEditable && (
        <>
          <Detail title="Amount Repayable" content={formatCurrency(loan.amountRepayable)} />
          <Detail title="Amount Repaid" content={formatCurrency(loan.amountRepaid)} />
          {loan.disbursementDate && (
            <Detail title="Disbursement Date" content={formatDate(loan.disbursementDate, "PPP")} />
          )}
        </>
      )}
      <Separator className="bg-[#F0F0F0]" />
    </div>
  );
}

export function UserCashLoanDetailsDisplay({ loan }: { loan: UserCashLoan }) {
  return (
    <div className="grid gap-4 p-4 sm:p-5">
      <Detail title="Loan ID" content={loan.id} />
      <Detail title="Loan Type" content={loan.category} />
      <Detail title="Loan Amount" content={formatCurrency(loan.amount)} />
      <Detail title="Amount Repayable" content={formatCurrency(loan.amountRepayable)} />
      <Detail title="Loan Repaid" content={formatCurrency(loan.amountRepaid)} />
      <Detail title="Loan Tenure" content={loan.loanTenure + " Months"} />
      {loan.assetName && <Detail title="Asset Name" content={loan.assetName} />}
      {loan.assetId && <Detail title="Asset ID" content={loan.assetId} />}
      {loan.disbursementDate && <Detail title="Disbursement Date" content={formatDate(loan.disbursementDate, "PPP")} />}
      <Detail title="Status" content={loan.status} />
      {/* <Detail title="Created At" content={formatDate(loan.createdAt, "PPP")} />
      <Detail title="Last Updated" content={formatDate(loan.updatedAt, "PPP")} /> */}
      <Separator className="bg-[#F0F0F0]" />
    </div>
  );
}
