"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { userPaymentMethod } from "@/lib/queries/user";

interface ApprovedLoanModalProps {
  loan: CashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDisbursement: () => void;
  loading: boolean;
}

export function ApprovedLoanModal({
  loan,
  isOpen,
  onOpenChange,
  onConfirmDisbursement,
  loading,
}: ApprovedLoanModalProps) {
  const [disbursementConfirmed, setDisbursementConfirmed] = useState(false);
  const { data, isLoading } = useQuery(userPaymentMethod);

  const disburseAmount = loan.amount - loan.amount * (loan.managementFeeRate / 100);
  const expectedInterestAmount = loan.amount * (loan.interestRate / 100);
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + loan.loanTenure);

  const handleConfirmDisbursementClick = () => {
    if (disbursementConfirmed) {
      onConfirmDisbursement();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Loan Disbursement</DialogTitle>
          {/* <DialogDescription>Confirm the disbursement details for the loan.</DialogDescription> */}
        </DialogHeader>
        <Separator className="bg-[#F0F0F0]" />

        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          {isLoading ? (
            <div className="grid gap-4 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonDetail key={index} />
              ))}
            </div>
          ) : !data?.data ? (
            <p>Payment method not found!</p>
          ) : (
            <div className="grid gap-4 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
              <Detail title="Bank Name" content={data.data.bankName} />
              <Detail title="Account Name" content={data.data.accountName} />
              <Detail title="Account Number" content={data.data.accountNumber} />
            </div>
          )}
          <div className="grid gap-4 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
            <Detail title="Amount to Disburse" content={formatCurrency(disburseAmount)} />
            <Detail title="Expected Interest Amount" content={formatCurrency(expectedInterestAmount)} />
            <Detail title="Total Expected Amount" content={formatCurrency(loan.amountRepayable)} />
            <Detail title="Due Date" content={formatDate(dueDate, "PPP")} />
          </div>
          <div className="flex items-start space-x-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <Checkbox
              id="disbursement-confirm"
              checked={disbursementConfirmed}
              onCheckedChange={(checked) => setDisbursementConfirmed(!!checked)}
              className="mt-0.5 border-red-400 data-[state=checked]:bg-red-600 data-[state=checked]:text-white"
              disabled={!data?.data}
            />
            <label
              htmlFor="disbursement-confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I can confirm that the requested funds for this particular loan application has been disbursed to the
              account details provided by the customer.
            </label>
          </div>
        </section>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
            onClick={handleConfirmDisbursementClick}
            disabled={!disbursementConfirmed}
            loading={loading}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  title: string;
  content: string;
}

function Detail({ title, content }: Props) {
  return (
    <div className="flex justify-between items-center gap-4">
      <p className="text-[#999999] text-sm font-normal">{title}</p>
      <p className="text-[#333333] text-sm font-medium">{content}</p>
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div className="flex justify-between items-center gap-4 animate-pulse">
      <div className="h-4 bg-gray-300 rounded w-1/3" />
      <div className="h-4 bg-gray-300 rounded w-1/2" />
    </div>
  );
}
