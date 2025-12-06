"use client";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getUserActiveLoan } from "@/lib/queries/admin/customer";
import { cn, formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "date-fns";

interface LoanDetailsDisplayProps {
  loan: CashLoan | UserCashLoan;
  isEditable?: boolean;
  onLoanTenureChange?: (value: number) => void;
  cName?: string;
  scrollable?: boolean;
}

export function LoanDetailsDisplay({
  loan,
  isEditable = false,
  scrollable = true,
  onLoanTenureChange,
  ...props
}: LoanDetailsDisplayProps) {
  const Component =
    "borrower" in loan ? (
      <CashLoanDetailsDisplay
        isEditable={isEditable}
        onLoanTenureChange={onLoanTenureChange}
        loan={loan}
        {...props}
      />
    ) : (
      <UserCashLoanDetailsDisplay loan={loan as UserCashLoan} {...props} />
    );

  return scrollable ? (
    <ScrollArea className="max-h-[70vh]">{Component}</ScrollArea>
  ) : (
    Component
  );
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

export function CashLoanDetailsDisplay({
  loan,
  isEditable,
  onLoanTenureChange,
  cName,
}: CashLoanDetailsDisplayProps) {
  const { data } = useQuery({
    ...getUserActiveLoan(loan.borrower.id),
    enabled: isEditable,
  });

  const lastLoanRequest =
    data?.data && data.data.length > 1 ? data.data[1] : null;

  return (
    <div className={cn("grid gap-4 p-4 sm:p-5", cName)}>
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#333333]">
          Customer Information
        </h3>
        <div className="grid gap-2 bg-[#FAFAFA] p-4 rounded-lg border border-[#F0F0F0]">
          <Detail title="Borrower Name" content={loan.borrower.name} />
          <Detail
            title="IPPIS ID"
            content={loan.borrower.externalId ?? ""}
          />{" "}
          <Detail
            title="Contact Info"
            content={loan.borrower.contact ?? loan.borrower.email ?? ""}
          />
        </div>
      </div>

      <Separator className="bg-[#F0F0F0]" />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#333333]">
          Loan Information
        </h3>
        <div className="grid gap-2">
          <Detail title="Loan Type" content={loan.category} />
          <Detail title="Loan Amount" content={formatCurrency(loan.amount)} />
          <Detail
            title={
              loan.disbursementDate ? "Disbursed Amount" : "Disbursable Amount"
            }
            content={formatCurrency(
              loan.amount - loan.amount * (loan.managementFeeRate / 100)
            )}
          />
          <Detail
            title="Interest Applied"
            content={`${formatCurrency(
              loan.amount * (loan.interestRate / 100)
            )} (${loan.interestRate}%)`}
          />
          <Detail
            title="Management Fee "
            content={`${formatCurrency(
              loan.amount * (loan.managementFeeRate / 100)
            )} (${loan.managementFeeRate}%)`}
          />
        </div>
      </div>

      <Separator className="bg-[#F0F0F0]" />
      <div className="grid gap-2">
        {isEditable ? (
          <>
            <div className="flex flex-col gap-2">
              {lastLoanRequest && (
                <p className="text-xs text-[#666666] leading-relaxed">
                  {" "}
                  Setting loan tenure will{" "}
                  <strong>add to the existing loan</strong>. <br /> Current
                  outstanding:{" "}
                  <strong>{formatCurrency(lastLoanRequest.amount)}</strong>{" "}
                </p>
              )}
              <p className="text-[#666666] text-sm font-normal">Loan Tenure</p>

              <div className="flex flex-col gap-1">
                <Input
                  type="number"
                  value={loan.tenure}
                  onChange={(e) =>
                    onLoanTenureChange?.(Number.parseFloat(e.target.value))
                  }
                  className="border border-[#F0F0F0] bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 text-[#666666] text-sm font-medium placeholder:text-[#666666] placeholder:text-sm placeholder:font-medium"
                />

                <span className="text-[#999999] text-xs font-normal">
                  New Active loan tenure:{" "}
                  {(lastLoanRequest?.tenure ?? 0) + (loan.tenure || 0)} months
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <Detail title="Loan Tenure" content={loan.tenure + " Months"} />
            <Detail
              title="Amount Repayable"
              content={formatCurrency(loan.amountRepayable)}
            />
            <Detail
              title="Amount Repaid"
              content={formatCurrency(loan.amountRepaid)}
            />
            {loan.disbursementDate && (
              <Detail
                title="Disbursement Date"
                content={formatDate(loan.disbursementDate, "PPP")}
              />
            )}
            <Detail title="Status" content={loan.status} />
          </>
        )}
      </div>

      <Separator className="bg-[#F0F0F0]" />
    </div>
  );
}

export function UserCashLoanDetailsDisplay({
  loan,
  cName,
}: {
  loan: UserCashLoan;
  cName?: string;
}) {
  return (
    <div className={cn("grid gap-4 p-4 sm:p-5", cName)}>
      <Detail title="Loan ID" content={loan.id} />
      <Detail title="Loan Type" content={loan.category} />
      <Detail title="Loan Amount" content={formatCurrency(loan.amount)} />
      <Detail
        title="Amount Repayable"
        content={formatCurrency(loan.amountRepayable)}
      />
      <Detail
        title="Amount Repaid"
        content={formatCurrency(loan.amountRepaid)}
      />
      {loan.tenure > 0 && (
        <Detail title="Loan Tenure" content={loan.tenure + " Months"} />
      )}
      {loan.assetName && <Detail title="Asset Name" content={loan.assetName} />}
      {loan.assetId && <Detail title="Asset ID" content={loan.assetId} />}
      {loan.disbursementDate && (
        <Detail
          title="Disbursement Date"
          content={formatDate(loan.disbursementDate, "PPP")}
        />
      )}
      <Detail title="Status" content={loan.status} />
      <Separator className="bg-[#F0F0F0]" />
    </div>
  );
}

export function CommodityLoanDetailsDisplay({
  loan,
}: {
  loan: CommodityLoanDto;
}) {
  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="grid gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[#333333]">
            Customer Information
          </h3>
          <div className="grid gap-2 bg-[#FAFAFA] p-4 rounded-lg border border-[#F0F0F0]">
            <Detail title="Borrower Name" content={loan.borrower.name} />
            <Detail
              title="IPPIS ID"
              content={loan.borrower.externalId ?? ""}
            />{" "}
            <Detail
              title="Contact Info"
              content={loan.borrower.contact ?? loan.borrower.email ?? ""}
            />
          </div>
        </div>
        <Detail title="Asset Loan ID" content={loan.id} />
        <Detail title="Asset Name" content={loan.name} />
        <Detail
          title="Request Date"
          content={formatDate(loan.createdAt, "PPP")}
        />
        <Detail
          title="Review Status"
          content={loan.inReview ? "In Review" : "Reviewed"}
        />
        {loan.publicDetails && (
          <div className="flex flex-col justify-between items-center gap-2">
            <p className="text-[#666666] text-sm font-normal">Public Details</p>
            <div className="p-3 bg-gray-50 rounded-md text-sm">
              {loan.publicDetails}
            </div>
          </div>
        )}
        {loan.privateDetails && (
          <div className="flex flex-col justify-between items-center gap-2">
            <p className="text-[#666666] text-sm font-normal">
              Private Details
            </p>
            <div className="p-3 bg-gray-50 rounded-md text-sm">
              {loan.privateDetails}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
