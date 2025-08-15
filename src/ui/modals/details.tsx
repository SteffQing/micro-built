"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CommodityLoanDetailsDisplay, LoanDetailsDisplay } from "./loan-details";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { cashLoanQuery } from "@/lib/queries/admin/cash-loans";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CashLoanDetailsProps {
  loan: CashLoan | UserCashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CashLoanDetails({ loan, isOpen, onOpenChange }: CashLoanDetailsProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Loan Details</DialogTitle>
        </DialogHeader>

        <Separator className="bg-[#F0F0F0]" />
        <LoanDetailsDisplay loan={loan} />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CommodityLoanDetailsProps extends Omit<CashLoanDetailsProps, "loan"> {
  loan: CommodityLoan;
}
export function CommodityLoanDetails({ loan, isOpen, onOpenChange }: CommodityLoanDetailsProps) {
  const { data, isLoading } = useQuery({
    ...cashLoanQuery(loan.loanId!),
    enabled: Boolean(loan.loanId),
  });
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Asset Loan Details</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <Separator className="bg-[#F0F0F0]" />
          <CommodityLoanDetailsDisplay loan={loan} />
          {loan.loanId && isLoading ? (
            <p>Fetching associated loan details...</p>
          ) : data?.data ? (
            <>
              <div className=" px-4 sm:px-5">
                <Separator className="bg-[#F0F0F0]" />
                <DialogTitle className="py-4">Associated Loan Details</DialogTitle>
              </div>
              <LoanDetailsDisplay loan={data?.data} />
            </>
          ) : null}
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
