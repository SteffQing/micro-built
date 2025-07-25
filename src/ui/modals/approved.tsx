"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "date-fns";

interface ApprovedLoanModalProps {
  loan: CashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDisbursement: () => void;
}

export function ApprovedLoanModal({ loan, isOpen, onOpenChange, onConfirmDisbursement }: ApprovedLoanModalProps) {
  const [disbursementConfirmed, setDisbursementConfirmed] = useState(false);

  const calculateExpectedInterest = (amount: number, interestRate: number, tenure: number) => {
    return amount * interestRate * (tenure / 12);
  };
  const calculateTotalExpectedAmount = (
    amount: number,
    interestRate: number,
    tenure: number,
    managementFeeRate: number
  ) => {
    const interest = calculateExpectedInterest(amount, interestRate, tenure);
    const managementFee = amount * managementFeeRate;
    return amount + interest + managementFee;
  };

  const expectedInterestAmount = calculateExpectedInterest(loan.amount, loan.interestRate, loan.loanTenure);
  const totalExpectedAmount = calculateTotalExpectedAmount(
    loan.amount,
    loan.interestRate,
    loan.loanTenure,
    loan.managementFeeRate
  );
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
          {/* <div className="grid gap-4 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
          <Detail title="Bank Name" content={paymentMethod.bankName} />
          <Detail title="Account Name" content={paymentMethod.accountName} />
          <Detail title="Account Number" content={paymentMethod.accountNumber} />
          </div> */}
          <div className="grid gap-4 bg-[#FAFAFA] rounded-[8px] p-4 sm:p-5 border border-[#F0F0F0]">
            <Detail title="Amount to Disburse" content={formatCurrency(loan.amount)} />
            <Detail title="Expected Interest Amount" content={formatCurrency(expectedInterestAmount)} />
            <Detail title="Total Expected Amount" content={formatCurrency(totalExpectedAmount)} />
            <Detail title="Due Date" content={formatDate(dueDate, "PPP")} />
          </div>
          <div className="flex items-start space-x-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <Checkbox
              id="disbursement-confirm"
              checked={disbursementConfirmed}
              onCheckedChange={(checked) => setDisbursementConfirmed(!!checked)}
              className="mt-0.5 border-red-400 data-[state=checked]:bg-red-600 data-[state=checked]:text-white"
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
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-[#8B0000] hover:bg-[#6A0000] text-white"
            onClick={handleConfirmDisbursementClick}
            disabled={!disbursementConfirmed}
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
