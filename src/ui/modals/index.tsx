"use client";

import { useState, type JSX } from "react";
import { PendingCommodityLoanModal, PendingLoanModal } from "./pending";
import { ApprovedLoanModal, CommodityLoanApprovalModal } from "./approved";
import { CashLoanDetails, CommodityLoanDetails } from "./details";
import { RejectConfirmationModal } from "./reject";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cashLoanQuery } from "@/lib/queries/admin/cash-loans";
import { userCashLoanQuery } from "@/lib/queries/user/loan";
import { Button } from "@/components/ui/button";
import { LoanStatus } from "@/config/enums";
import { disburse, reject, approve } from "@/lib/mutations/admin/cash-loans";
import { commodityLoanQuery } from "@/lib/queries/admin/commodity-loans";
import {
  approve as approveAssetLoan,
  reject as rejectAssetLoan,
} from "@/lib/mutations/admin/commodity-loan";

type Props = {
  id: string;
  trigger?: JSX.Element;
};

export function CashLoanModal({ id, trigger }: Props) {
  const [isOpen, setisOpen] = useState(false);
  const handleOpen = (val: boolean) => {
    setisOpen(val);
  };
  const [isRejectConfirmationOpen, setIsRejectConfirmationOpen] =
    useState(false);
  const { data, isLoading, error } = useQuery({
    ...cashLoanQuery(id),
    enabled: isOpen,
  });

  const disburseLoan = useMutation(disburse(id));
  const rejectLoan = useMutation(reject(id));
  const approveLoan = useMutation(approve(id));

  const loan = data?.data;

  const handleRejectInitiate = () => {
    setIsRejectConfirmationOpen(true);
  };

  const handleCloseMainModal = () => {
    handleOpen(false);
  };

  async function handleApproveLoan(tenure: number) {
    await approveLoan.mutateAsync({ tenure });
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
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Fetching loan data...</p>
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
        return (
          <PendingLoanModal
            {...commonProps}
            onSetTerms={handleApproveLoan}
            loading={approveLoan.isPending}
          />
        );
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
        return <CashLoanDetails {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="outline" size="sm" className="text-xs">
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
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
  const [isRejectConfirmationOpen, setIsRejectConfirmationOpen] =
    useState(false);
  const { data, isLoading, error } = useQuery({
    ...userCashLoanQuery(id),
    enabled: isOpen,
  });

  const loan = data?.data;

  const handleRejectInitiate = () => {
    setIsRejectConfirmationOpen(true);
  };

  const handleCloseMainModal = () => {
    handleOpen(false);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Loading Loan Details...</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Fetching loan data...</p>
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

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <CashLoanDetails {...commonProps} />
        {/* {loan && (
          <RejectConfirmationModal
            loan={loan}
            isOpen={isRejectConfirmationOpen}
            onOpenChange={setIsRejectConfirmationOpen}
            onConfirmReject={handleConfirmReject}
            loading={updateLoanStatus.isPending}
          />
        )} */}
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
  const [isRejectConfirmationOpen, setIsRejectConfirmationOpen] =
    useState(false);
  const [isApproveConfirmationOpen, setIsApproveConfirmationOpen] =
    useState(false);
  const { data, isLoading, error } = useQuery({
    ...commodityLoanQuery(id),
    enabled: isOpen,
  });

  // const { data: protocolConfigDetails, isLoading: isConfigLoading } =
  // 	useQuery(configData);

  // console.log({
  // 	protocolConfigDetails,
  // 	xxx: protocolConfigDetails?.data?.interestRate,
  // });

  const approveLoan = useMutation(approveAssetLoan(id));
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

  const renderCurrentModal = (loan: CommodityLoanDto | null | undefined) => {
    if (!loan) return null;
    if (loan.inReview)
      return (
        <PendingCommodityLoanModal
          {...commonProps}
          onApproveInitiate={handleApproveInitiate}
        />
      );
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
        <DialogHeader>
          <DialogTitle>Loan Details</DialogTitle>
        </DialogHeader>
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
              borrowerId={loan.borrower.id}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
