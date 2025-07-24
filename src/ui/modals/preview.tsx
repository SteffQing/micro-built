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

interface PreviewLoanModalProps {
  loan: UserCashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onRejectInitiate?: () => void;
}

export function PreviewLoanModal({ loan, isOpen, onOpenChange, onAccept, onRejectInitiate }: PreviewLoanModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Loan Offer Details</DialogTitle>
          <DialogDescription>Review the loan terms and decide to accept or reject.</DialogDescription>
        </DialogHeader>
        <LoanDetailsDisplay loan={loan} />
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={onRejectInitiate}>
            Reject Offer
          </Button>
          <Button className="bg-[#8B0000] hover:bg-[#6A0000] text-white" onClick={onAccept}>
            Accept Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
