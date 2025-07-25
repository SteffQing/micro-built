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
import { Separator } from "@/components/ui/separator";

interface RejectConfirmationModalProps {
  loan: {
    amount: number;
    id: string;
  };
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

        <Separator className="bg-[#F0F0F0]" />
        <DialogDescription className="grid gap-4 p-4 sm:p-5">
          Are you sure you want to reject the loan request of {formatCurrency(loan.amount)} with loan id: ${loan.id}
        </DialogDescription>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            No, Cancel
          </Button>
          <Button
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
            onClick={onConfirmReject}
          >
            Yes, Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
