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
import { formatCurrency } from "@/lib/utils";

interface RejectConfirmationModalProps {
  loan: Loan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmReject: () => void;
}

export function RejectConfirmationModal({ loan, isOpen, onOpenChange, onConfirmReject }: RejectConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Reject Loan</DialogTitle>
        </DialogHeader>
        <DialogDescription className="py-4">
          Are you sure you want to reject the loan request of {formatCurrency(loan.amount)} from {loan.borrower.name}?
        </DialogDescription>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            No, Cancel
          </Button>
          <Button className="bg-[#8B0000] hover:bg-[#6A0000] text-white" onClick={onConfirmReject}>
            Yes, Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
