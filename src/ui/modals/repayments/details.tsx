"use client";

import { Button } from "@/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import RepaymentDetailsDisplay from "./repayment-details";

interface DetailsProps {
  repayment: SingleRepaymentWithUserDto | SingleUserRepaymentDto;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Renders the inner modal content only — the parent (AdminRepaymentModal /
// UserRepaymentModal) owns the single Dialog + DialogContent wrapper, so this
// must not nest another Dialog (that was the source of the broken padding).
export function RepaymentDetails({ repayment, onOpenChange }: DetailsProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Repayment Details</DialogTitle>
      </DialogHeader>

      <Separator className="bg-border" />
      <RepaymentDetailsDisplay repayment={repayment} />

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
        >
          Close
        </Button>
      </DialogFooter>
    </>
  );
}
