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
  loan: Loan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSetTerms?: (loanId: string, newTerms: { loanTenure: number }) => void;
  onRejectInitiate?: () => void;
}

export function PendingLoanModal({ loan, isOpen, onOpenChange, onSetTerms }: PendingLoanModalProps) {
  // State for editable terms, initialized from loan prop
  const [editableLoanTenure, setEditableLoanTenure] = useState(loan.loanTenure);
  const [editableInterestRate, setEditableInterestRate] = useState(loan.interestRate);
  const [editableManagementFeeRate, setEditableManagementFeeRate] = useState(loan.managementFeeRate);

  // Update editable states when the loan prop changes
  useEffect(() => {
    setEditableLoanTenure(loan.loanTenure);
    setEditableInterestRate(loan.interestRate);
    setEditableManagementFeeRate(loan.managementFeeRate);
  }, [loan]);

  const handleSetTermsClick = () => {
    onSetTerms?.(loan.id, {
      loanTenure: editableLoanTenure,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Set Loan Terms</DialogTitle>
          <DialogDescription>Admin can set the terms for this loan request.</DialogDescription>
        </DialogHeader>
        <LoanDetailsDisplay
          loan={{
            ...loan, // Pass original loan for other details
            loanTenure: editableLoanTenure, // Override with editable state
            interestRate: editableInterestRate,
            managementFeeRate: editableManagementFeeRate,
          }}
          isEditable
          onLoanTenureChange={setEditableLoanTenure}
        />
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-[#8B0000] hover:bg-[#6A0000] text-white" onClick={handleSetTermsClick}>
            Save Terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
