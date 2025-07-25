"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoanDetailsDisplay } from "./loan-details";
import { Separator } from "@/components/ui/separator";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Loan Offer Details</DialogTitle>
          {/* Awaiting user approval */}
        </DialogHeader>

        <Separator className="bg-[#F0F0F0]" />
        <LoanDetailsDisplay loan={loan} />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onRejectInitiate}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Reject Offer
          </Button>
          <Button className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient" onClick={onAccept}>
            Accept Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
