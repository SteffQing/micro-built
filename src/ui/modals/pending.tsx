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
import { Separator } from "@/components/ui/separator";

interface PendingLoanModalProps {
  loan: CashLoan | UserCashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSetTerms?: (loanTenure: number) => void;
  onRejectInitiate?: () => void;
  loading: boolean;
}

export function PendingLoanModal({
  loan,
  isOpen,
  onOpenChange,
  onSetTerms,
  onRejectInitiate,
  loading,
}: PendingLoanModalProps) {
  const [editableLoanTenure, setEditableLoanTenure] = useState(loan.loanTenure);

  useEffect(() => {
    setEditableLoanTenure(loan.loanTenure);
  }, [loan]);

  const handleSetTermsClick = () => {
    onSetTerms?.(editableLoanTenure);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Loan Terms</DialogTitle>
        </DialogHeader>
        <Separator className="bg-[#F0F0F0]" />
        <LoanDetailsDisplay
          loan={{
            ...loan,
            loanTenure: editableLoanTenure,
          }}
          isEditable
          onLoanTenureChange={setEditableLoanTenure}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onRejectInitiate}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
            disabled={loading}
          >
            Reject Loan
          </Button>
          <Button
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
            onClick={handleSetTermsClick}
            loading={loading}
          >
            Set Terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
