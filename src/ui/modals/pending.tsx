"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoanDetailsDisplay } from "./loan-details";

interface PendingLoanModalProps {
  loan: CashLoan | UserCashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSetTerms?: (loanTenure: number) => void;
  onRejectInitiate?: () => void;
}

export function PendingLoanModal({ loan, isOpen, onOpenChange, onSetTerms, onRejectInitiate }: PendingLoanModalProps) {
  const [editableLoanTenure, setEditableLoanTenure] = useState(loan.loanTenure);

  useEffect(() => {
    setEditableLoanTenure(loan.loanTenure);
  }, [loan]);

  const handleSetTermsClick = () => {
    onSetTerms?.(editableLoanTenure);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Set Loan Terms</DialogTitle>
          <DialogDescription>
            You can set the terms for this loan request by applying a loan tenure and the system automatically applies
            current interest and management fee rate! <br />
            Loan can also be rejected
          </DialogDescription>
        </DialogHeader>
        <LoanDetailsDisplay
          loan={{
            ...loan,
            loanTenure: editableLoanTenure,
          }}
          isEditable
          onLoanTenureChange={setEditableLoanTenure}
        />
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={onRejectInitiate}>
            Reject Loan
          </Button>
          <Button className="bg-[#8B0000] hover:bg-[#6A0000] text-white" onClick={handleSetTermsClick}>
            Set Terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
