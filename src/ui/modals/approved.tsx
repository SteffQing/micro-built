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

interface ApprovedLoanModalProps {
  loan: Loan;
  paymentMethod: UserPaymentMethod;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDisbursement?: (loanId: string) => void;
}

export function ApprovedLoanModal({
  loan,
  paymentMethod,
  isOpen,
  onOpenChange,
  onConfirmDisbursement,
}: ApprovedLoanModalProps) {
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
      onConfirmDisbursement?.(loan.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Loan Disbursement</DialogTitle>
          <DialogDescription>Confirm the disbursement details for the loan.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2 border-b pb-4">
            <div className="grid grid-cols-2 items-center gap-4">
              <Label className="text-muted-foreground">Bank Name</Label>
              <span className="text-right font-medium">{paymentMethod.bankName}</span>
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label className="text-muted-foreground">Account Name</Label>
              <span className="text-right font-medium">{paymentMethod.accountName}</span>
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label className="text-muted-foreground">Account Number</Label>
              <span className="text-right font-medium">{paymentMethod.accountNumber}</span>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-2 items-center gap-4">
              <Label className="text-muted-foreground">Amount to Disburse</Label>
              <span className="text-right font-medium">{formatCurrency(loan.amount)}</span>
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label className="text-muted-foreground">Expected Interest Amount</Label>
              <span className="text-right font-medium">{formatCurrency(expectedInterestAmount)}</span>
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label className="text-muted-foreground">Total Expected Amount</Label>
              <span className="text-right font-medium">{formatCurrency(totalExpectedAmount)}</span>
            </div>
            <div className="grid grid-cols-2 items-center gap-4">
              <Label className="text-muted-foreground">Due Date</Label>
              <span className="text-right font-medium">
                {dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
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
        </div>
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
