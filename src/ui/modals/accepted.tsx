"use client";

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

interface AcceptedLoanModalProps {
  loan: Loan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (loanId: string) => void;
  onRejectInitiate?: () => void;
}

export function AcceptedLoanModal({ loan, isOpen, onOpenChange, onApprove, onRejectInitiate }: AcceptedLoanModalProps) {
  const handleApproveClick = () => {
    onApprove?.(loan.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Loan Details</DialogTitle>
          <DialogDescription>Review the loan details and decide to approve or reject.</DialogDescription>
        </DialogHeader>
        <LoanDetailsDisplay loan={loan} />
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={onRejectInitiate}>
            Reject
          </Button>
          <Button className="bg-[#8B0000] hover:bg-[#6A0000] text-white" onClick={handleApproveClick}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
