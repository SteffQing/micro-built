"use client";

import { useState } from "react";
import { PendingLoanModal } from "./pending";
import { PreviewLoanModal } from "./preview";
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
};

export function CashLoanModal({ id }: Props) {
  const [isOpen, setisOpen] = useState(false);
  const handleOpen = (val: boolean) => {
    setisOpen(val);
  };
  const [isRejectConfirmationOpen, setIsRejectConfirmationOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    ...cashLoanQuery(id),
    enabled: isOpen,
  });

  const loan = data?.data;

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

  const commonProps = {
    loan: loan!,
    isOpen: isOpen && !isRejectConfirmationOpen,
    onOpenChange: handleCloseMainModal,
    onRejectInitiate: handleRejectInitiate,
  };

  const renderCurrentModal = (loan: CashLoan | null | undefined) => {
    if (!loan) return null;
    switch (loan.status) {
      case LoanStatus.PENDING:
        return <PendingLoanModal {...commonProps} onSetTerms={onSetTerms} />;
      case LoanStatus.APPROVED:
        return <ApprovedLoanModal {...commonProps} onConfirmDisbursement={onConfirmDisbursement} />;
      case LoanStatus.REJECTED:
      case LoanStatus.DISBURSED:
      case LoanStatus.REPAID:
      case LoanStatus.PREVIEW:
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
        {renderCurrentModal(loan)}
        {loan && (
          <RejectConfirmationModal
            loan={loan}
            isOpen={isRejectConfirmationOpen}
            onOpenChange={setIsRejectConfirmationOpen}
            onConfirmReject={handleConfirmReject}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function UserCashLoanModal({ id }: Props) {
  const [isOpen, setisOpen] = useState(false);
  const handleOpen = (val: boolean) => {
    setisOpen(val);
  };
  const [isRejectConfirmationOpen, setIsRejectConfirmationOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    ...userCashLoanQuery(id),
    enabled: isOpen,
  });

  const loan = data?.data;

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

  function onAccept() {}

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

  const commonProps = {
    loan: loan!,
    isOpen: isOpen && !isRejectConfirmationOpen,
    onOpenChange: handleCloseMainModal,
    onRejectInitiate: handleRejectInitiate,
  };

  const renderCurrentModal = (loan: UserCashLoan | null | undefined) => {
    if (!loan) return null;
    switch (loan.status) {
      case LoanStatus.PREVIEW:
        return <PreviewLoanModal {...commonProps} onAccept={onAccept} />;
      case LoanStatus.PENDING:
      case LoanStatus.APPROVED:
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
        {renderCurrentModal(loan)}
        {loan && (
          <RejectConfirmationModal
            loan={loan}
            isOpen={isRejectConfirmationOpen}
            onOpenChange={setIsRejectConfirmationOpen}
            onConfirmReject={handleConfirmReject}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
