"use client";

import { Button } from "@/components/ui/button";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CommodityLoanDetailsDisplay, LoanDetailsDisplay } from "./loan-details";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { cashLoanQuery } from "@/lib/queries/admin/cash-loans";

interface CashLoanDetailsProps {
  loan: CashLoan | UserCashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
export function CashLoanDetails({ loan, isOpen, onOpenChange }: CashLoanDetailsProps) {
  if (!isOpen) return null;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Loan Details</DialogTitle>
      </DialogHeader>

      <Separator className="bg-border" />
      <LoanDetailsDisplay loan={loan} />

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

interface CommodityLoanDetailsProps extends Omit<CashLoanDetailsProps, "loan"> {
  loan: CommodityLoanDto;
}
export function CommodityLoanDetails({ loan, isOpen, onOpenChange }: CommodityLoanDetailsProps) {
  const { data, isLoading } = useQuery({
    ...cashLoanQuery(loan.loanId!),
    enabled: Boolean(loan.loanId),
  });
  if (!isOpen) return null;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Asset Loan Details</DialogTitle>
      </DialogHeader>
      <div className="min-w-0">
        <Separator className="bg-border" />
        <CommodityLoanDetailsDisplay loan={loan} />
        {loan.loanId && isLoading ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-5">Fetching associated loan details...</p>
        ) : data?.data ? (
          <>
            <div className="px-4 sm:px-5">
              <Separator className="bg-border" />
              <h3 className="py-4 text-base font-semibold">Associated Loan Details</h3>
            </div>
            <LoanDetailsDisplay loan={data.data} />
          </>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm">
          Close
        </Button>
      </DialogFooter>
    </>
  );
}
