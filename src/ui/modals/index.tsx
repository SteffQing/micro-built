"use client";

import { useState } from "react";
import { PendingLoanModal } from "./pending";
import { PreviewLoanModal } from "./preview";
import { AcceptedLoanModal } from "./accepted";
import { ApprovedLoanModal } from "./approved";
import { RejectedDisbursedRepaidLoanModal } from "./rejected-disbursed-repaid";
import { RejectConfirmationModal } from "./reject";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cashLoanQuery } from "@/lib/queries/admin/cash-loans";
import { userCashLoanQuery } from "@/lib/queries/user/loan";
import { Button } from "@/components/ui/button";
import { LoanStatus } from "@/config/enums";

type Props = {
  id: string;
  isAdmin: boolean;
};

export default function CashLoanModal({ id, isAdmin }: Props) {
  const [isOpen, setisOpen] = useState(false);
  const handleOpen = (val: boolean) => {
    setisOpen(val);
  };
  const [isRejectConfirmationOpen, setIsRejectConfirmationOpen] = useState(false);

  const { data: aLoan, isLoading: aLoad, error: aError } = useQuery({ ...cashLoanQuery(id), enabled: isAdmin });
  const { data: uLoan, isLoading: uLoad, error: uError } = useQuery({ ...userCashLoanQuery(id), enabled: !isAdmin });

  const isLoading = aLoad || uLoad;
  const error = aError || uError;
  const loan = aLoan?.data || uLoan?.data;

  const handleRejectInitiate = () => {
    setIsRejectConfirmationOpen(true);
  };

  const handleConfirmReject = () => {
    // reject the loan in an api request
    setIsRejectConfirmationOpen(false);
    handleOpen(false);
  };

  const handleCloseMainModal = () => {
    handleOpen(false);
  };

  function onSetTerms(tenure: number) {}
  function onAccept() {}
  function onApprove() {}
  function onConfirmDisbursement() {}

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Loading Loan Details...</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <p className="mt-4 text-gray-600">Fetching loan data...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center text-red-600">
            <p>{error.message}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!loan) return null;

  const commonProps = {
    loan,
    isOpen: isOpen && !isRejectConfirmationOpen,
    onOpenChange: handleCloseMainModal,
    onRejectInitiate: handleRejectInitiate,
  };

  const renderCurrentModal = () => {
    switch (loan.status) {
      case LoanStatus.PENDING:
        return <PendingLoanModal {...commonProps} onSetTerms={onSetTerms} />;
      case LoanStatus.PREVIEW:
        return <PreviewLoanModal {...commonProps} loan={uLoan?.data as UserCashLoan} onAccept={onAccept} />;
      case LoanStatus.ACCEPTED:
        return <AcceptedLoanModal {...commonProps} loan={aLoan?.data as CashLoan} onApprove={onApprove} />;
      case LoanStatus.APPROVED:
        return (
          <ApprovedLoanModal
            {...commonProps}
            loan={aLoan?.data as CashLoan}
            onConfirmDisbursement={onConfirmDisbursement}
          />
        );
      case LoanStatus.REJECTED:
      case LoanStatus.DISBURSED:
      case LoanStatus.REPAID:
        return <RejectedDisbursedRepaidLoanModal {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {renderCurrentModal()}
        <RejectConfirmationModal
          loan={loan}
          isOpen={isRejectConfirmationOpen}
          onOpenChange={setIsRejectConfirmationOpen}
          onConfirmReject={handleConfirmReject}
        />
      </DialogContent>
    </Dialog>
  );
}
