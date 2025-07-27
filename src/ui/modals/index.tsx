"use client";

import { useState } from "react";
import { PendingCommodityLoanModal, PendingLoanModal } from "./pending";
import { PreviewLoanModal } from "./preview";
import { ApprovedLoanModal, CommodityLoanApprovalModal } from "./approved";
import { CashLoanDetails, CommodityLoanDetails } from "./details";
import { RejectConfirmationModal } from "./reject";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cashLoanQuery } from "@/lib/queries/admin/cash-loans";
import { userCashLoanQuery } from "@/lib/queries/user/loan";
import { Button } from "@/components/ui/button";
import { LoanStatus } from "@/config/enums";
import { disburse, reject, setTerms } from "@/lib/mutations/admin/cash-loans";
import { updateCashLoanStatus } from "@/lib/mutations/user/loans";
import { commodityLoanQuery } from "@/lib/queries/admin/commodity-loans";
import { approve, reject as rejectAssetLoan } from "@/lib/mutations/admin/commodity-loan";

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

  const disburseLoan = useMutation(disburse(id));
  const setLoanTerms = useMutation(setTerms(id));
  const rejectLoan = useMutation(reject(id));

  const loan = data?.data;

  const handleRejectInitiate = () => {
    setIsRejectConfirmationOpen(true);
  };

  const handleCloseMainModal = () => {
    handleOpen(false);
  };

  async function onSetTerms(tenure: number) {
    await setLoanTerms.mutateAsync({ tenure });
    setIsRejectConfirmationOpen(false);
    handleOpen(false);
  }
  async function onConfirmDisbursement() {
    await disburseLoan.mutateAsync();
    setIsRejectConfirmationOpen(false);
    handleOpen(false);
  }
  async function handleConfirmReject() {
    await rejectLoan.mutateAsync();
    setIsRejectConfirmationOpen(false);
    handleOpen(false);
  }

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
        return <PendingLoanModal {...commonProps} onSetTerms={onSetTerms} loading={setLoanTerms.isPending} />;
      case LoanStatus.APPROVED:
        return (
          <ApprovedLoanModal
            {...commonProps}
            onConfirmDisbursement={onConfirmDisbursement}
            loading={disburseLoan.isPending}
          />
        );
      case LoanStatus.REJECTED:
      case LoanStatus.DISBURSED:
      case LoanStatus.REPAID:
      case LoanStatus.PREVIEW:
        return <CashLoanDetails {...commonProps} />;
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
            loading={rejectLoan.isPending}
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

  const updateLoanStatus = useMutation(updateCashLoanStatus(id));

  const loan = data?.data;

  const handleRejectInitiate = () => {
    setIsRejectConfirmationOpen(true);
  };

  const handleConfirmReject = async () => {
    await updateLoanStatus.mutateAsync({ status: LoanStatus.REJECTED });
    setIsRejectConfirmationOpen(false);
    handleOpen(false);
  };

  const handleCloseMainModal = () => {
    handleOpen(false);
  };

  async function onAccept() {
    await updateLoanStatus.mutateAsync({ status: LoanStatus.APPROVED });
    setIsRejectConfirmationOpen(false);
    handleOpen(false);
  }

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
        return <PreviewLoanModal {...commonProps} onAccept={onAccept} loading={updateLoanStatus.isPending} />;
      case LoanStatus.PENDING:
      case LoanStatus.APPROVED:
      case LoanStatus.REJECTED:
      case LoanStatus.DISBURSED:
      case LoanStatus.REPAID:
        return <CashLoanDetails {...commonProps} />;
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
            loading={updateLoanStatus.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CommodityLoanModal({ id }: Props) {
  const [isOpen, setisOpen] = useState(false);
  const handleOpen = (val: boolean) => {
    setisOpen(val);
  };
  const handleCloseMainModal = () => {
    handleOpen(false);
  };
  const [isRejectConfirmationOpen, setIsRejectConfirmationOpen] = useState(false);
  const [isApproveConfirmationOpen, setIsApproveConfirmationOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    ...commodityLoanQuery(id),
    enabled: isOpen,
  });

  const approveLoan = useMutation(approve(id));
  const rejectLoan = useMutation(rejectAssetLoan(id));

  const loan = data?.data;

  const handleRejectInitiate = () => {
    setIsRejectConfirmationOpen(true);
  };

  const handleApproveInitiate = () => {
    setIsApproveConfirmationOpen(true);
  };

  async function handleConfirmApprove(data: AcceptCommodityLoan) {
    await approveLoan.mutateAsync(data);
    setIsApproveConfirmationOpen(false);
    handleCloseMainModal();
  }
  async function handleConfirmReject() {
    await rejectLoan.mutateAsync();
    setIsRejectConfirmationOpen(false);
    handleCloseMainModal();
  }

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Loading Asset Loan Details...</DialogTitle>
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

  const renderCurrentModal = (loan: CommodityLoan | null | undefined) => {
    if (!loan) return null;
    if (loan.inReview) return <PendingCommodityLoanModal {...commonProps} onApproveInitiate={handleApproveInitiate} />;
    else return <CommodityLoanDetails {...commonProps} />;
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
          <>
            <RejectConfirmationModal
              loan={loan}
              isOpen={isRejectConfirmationOpen}
              onOpenChange={setIsRejectConfirmationOpen}
              onConfirmReject={handleConfirmReject}
              loading={rejectLoan.isPending}
            />
            <CommodityLoanApprovalModal
              assetName={loan.name}
              isOpen={isApproveConfirmationOpen}
              onOpenChange={setIsApproveConfirmationOpen}
              onSubmit={handleConfirmApprove}
              isSubmitting={approveLoan.isPending}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
