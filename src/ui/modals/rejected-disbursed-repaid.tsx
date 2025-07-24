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

interface RejectedDisbursedRepaidLoanModalProps {
  loan: CashLoan | UserCashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RejectedDisbursedRepaidLoanModal({
  loan,
  isOpen,
  onOpenChange,
}: RejectedDisbursedRepaidLoanModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Loan Details</DialogTitle>
          <DialogDescription>Full details of the {loan.status.toLowerCase()} loan.</DialogDescription>
        </DialogHeader>
        <LoanDetailsDisplay loan={loan} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
