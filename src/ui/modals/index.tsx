"use client";

import { useState } from "react";
import { PendingLoanModal } from "./pending";
import { PreviewLoanModal } from "./preview";
import { AcceptedLoanModal } from "./accepted";
import { ApprovedLoanModal } from "./approved";
import { RejectedDisbursedRepaidLoanModal } from "./rejected-disbursed-repaid";
import { RejectConfirmationModal } from "./reject";

interface LoanModalsProps {
  loan: Loan;
  isOpen: boolean;
  paymentMethod?: UserPaymentMethod;
  onOpenChange: (open: boolean) => void;
  onApprove?: (loanId: string) => void;
  onReject?: (loanId: string) => void;
  onAccept?: (loanId: string) => void;
  onSetTerms?: (loanId: string, newTerms: { loanTenure: number }) => void;
  onConfirmDisbursement?: (loanId: string) => void;
}

export function LoanModals({
  loan,
  isOpen,
  paymentMethod,
  onOpenChange,
  onApprove,
  onReject,
  onAccept,
  onSetTerms,
  onConfirmDisbursement,
}: LoanModalsProps) {
  const [isRejectConfirmationOpen, setIsRejectConfirmationOpen] = useState(false);

  const handleRejectInitiate = () => {
    setIsRejectConfirmationOpen(true);
  };

  const handleConfirmReject = () => {
    onReject?.(loan.id);
    setIsRejectConfirmationOpen(false);
    onOpenChange(false);
  };

  const handleCloseMainModal = () => {
    onOpenChange(false);
  };

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
        return <PreviewLoanModal {...commonProps} onAccept={onAccept} />;
      case LoanStatus.ACCEPTED:
        return <AcceptedLoanModal {...commonProps} onApprove={onApprove} />;
      case LoanStatus.APPROVED:
        return (
          <ApprovedLoanModal
            {...commonProps}
            paymentMethod={paymentMethod!}
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
    <>
      {renderCurrentModal()}
      <RejectConfirmationModal
        loan={loan}
        isOpen={isRejectConfirmationOpen}
        onOpenChange={setIsRejectConfirmationOpen}
        onConfirmReject={handleConfirmReject}
      />
    </>
  );
}
