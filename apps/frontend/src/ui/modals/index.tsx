"use client";

import { useState, type JSX } from "react";
import { PendingCommodityLoanModal, PendingLoanModal } from "./pending";
import { ApprovedAssetTopupModal, ApprovedCommodityLoanModal, ApprovedLoanModal } from "./approved";
import { disburseTopup, rejectTopup } from "@/lib/mutations/admin/topups";
import { useUserProvider } from "@/store/auth";
import { CashLoanDetails, CommodityLoanDetails } from "./details";
import { RejectConfirmationModal } from "./reject";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Icon, icons } from "@/components/icon";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cashLoanQuery } from "@/lib/queries/admin/cash-loans";
import { userCashLoanQuery } from "@/lib/queries/user/loan";
import { Button } from "@/components/ui/button";
import { LoanStatus } from "@/config/enums";
import { disburse, reject, approve } from "@/lib/mutations/admin/cash-loans";
import { commodityLoanQuery } from "@/lib/queries/admin/commodity-loans";
import { approve as approveAssetLoan, reject as rejectAssetLoan } from "@/lib/mutations/admin/commodity-loan";
import CommodityLoanApprovalModal from "./approve-commodity-loan";

type Props = {
  id: string;
  trigger?: JSX.Element;
};

export function CashLoanModal({
  id,
  trigger,
  open: openProp,
  onOpenChange,
}: Props & {
  /** Controlled from outside (a dashboard or notification link), with no trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const isOpen = controlled ? openProp : openState;
  const handleOpen = (val: boolean) => {
    if (controlled) onOpenChange?.(val);
    else setOpenState(val);
  };
  const [isRejectConfirmationOpen, setIsRejectConfirmationOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    ...cashLoanQuery(id),
    enabled: isOpen,
  });

  const disburseLoan = useMutation(disburse(id));
  const rejectLoan = useMutation(reject(id));
  const approveLoan = useMutation(approve(id));
  const { userRole } = useUserProvider();

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

  const renderCurrentModal = (loan: CashLoan | null | undefined) => {
    if (isLoading) {
      return (
        <>
          <DialogHeader>
            <DialogTitle>Loading Loan Details...</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center px-4 pb-8 sm:px-5">
            <Icon icon={icons.loaderCircle} size={32} className="animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Fetching loan data...</p>
          </div>
        </>
      );
    }
    if (error) {
      return (
        <>
          <DialogHeader>
            <DialogTitle>Unable to load loan details</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-6 text-center text-sm break-words text-destructive sm:px-5">
            {error.message}
          </div>
        </>
      );
    }
    if (!loan) {
      return (
        <>
          <DialogHeader>
            <DialogTitle>Loan details unavailable</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-6 text-center text-sm break-words text-muted-foreground sm:px-5">
            No loan record was returned for {id}.
          </div>
        </>
      );
    }
    const commonProps = {
      loan,
      isOpen: isOpen && !isRejectConfirmationOpen,
      onOpenChange: handleCloseMainModal,
      onRejectInitiate: handleRejectInitiate,
    };
    switch (loan.status) {
      case LoanStatus.PENDING:
        return <PendingLoanModal {...commonProps} onSetTerms={handleApproveLoan} loading={approveLoan.isPending} />;
      case LoanStatus.APPROVED:
        return (
          <ApprovedLoanModal
            {...commonProps}
            canDisburse={userRole === "SUPER_ADMIN"}
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
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <Button variant="outline" size="sm" className="text-xs">
              <Icon icon={icons.view} size={12} className="mr-1" />
              View
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] rounded-lg">
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
          <div className="flex flex-col items-center justify-center px-4 pb-8 sm:px-5">
            <Icon icon={icons.loaderCircle} size={32} className="animate-spin text-muted-foreground" />
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
          <div className="px-4 pb-4 text-center break-words text-destructive sm:px-5 sm:pb-5">
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
          <Icon icon={icons.view} size={12} className="mr-1" />
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

export function CommodityLoanModal({
  id,
  open: openProp,
  onOpenChange,
}: Props & {
  /** Controlled from outside (a notification link), with no View button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const isOpen = controlled ? openProp : openState;
  const handleOpen = (val: boolean) => {
    if (controlled) onOpenChange?.(val);
    else setOpenState(val);
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

  const approveLoan = useMutation(approveAssetLoan(id));
  const rejectLoan = useMutation(rejectAssetLoan(id));

  const loan = data?.data;
  const disburseLoan = useMutation(disburse(loan?.loanId || id));
  // An asset top-up is paid out as its top-up (microloan), not by disbursing the running loan.
  const disburseAssetTopup = useMutation(disburseTopup(loan?.topup?.id ?? ""));
  // Once approved, the asset request is past review: an asset loan is rejected as its loan, a top-up as its top-up.
  const rejectApprovedLoan = useMutation(reject(loan?.loanId ?? ""));
  const rejectAssetTopup = useMutation(rejectTopup(loan?.topup?.id ?? ""));
  const approvedTopup = loan?.kind === "TOPUP" && loan.topup?.status === "APPROVED";
  const approvedLoan = !approvedTopup && loan?.loan?.status === "APPROVED";
  const rejecting = rejectLoan.isPending || rejectApprovedLoan.isPending || rejectAssetTopup.isPending;
  const { userRole } = useUserProvider();

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
    if (approvedTopup) await rejectAssetTopup.mutateAsync(undefined);
    else if (approvedLoan) await rejectApprovedLoan.mutateAsync();
    else await rejectLoan.mutateAsync();
    setIsRejectConfirmationOpen(false);
    handleCloseMainModal();
  }

  async function onConfirmDisbursement() {
    await disburseLoan.mutateAsync();
    setIsRejectConfirmationOpen(false);
    handleOpen(false);
  }

  const renderCurrentModal = (loan: CommodityLoanDto | null | undefined) => {
    if (isLoading) {
      return (
        <>
          <DialogHeader><DialogTitle>Loading Asset Loan Details...</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center justify-center px-4 pb-8 sm:px-5">
            <Icon icon={icons.loaderCircle} size={32} className="animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Fetching asset and financing data...</p>
          </div>
        </>
      );
    }
    if (error) {
      return (
        <>
          <DialogHeader><DialogTitle>Unable to load asset loan</DialogTitle></DialogHeader>
          <div className="px-4 pb-6 text-center text-sm break-words text-destructive sm:px-5">{error.message}</div>
        </>
      );
    }
    if (!loan) {
      return (
        <>
          <DialogHeader><DialogTitle>Asset loan unavailable</DialogTitle></DialogHeader>
          <div className="px-4 pb-6 text-center text-sm break-words text-muted-foreground sm:px-5">No commodity request was returned for {id}.</div>
        </>
      );
    }
    const commonProps = {
      loan,
      isOpen: isOpen && !isRejectConfirmationOpen,
      onOpenChange: handleCloseMainModal,
      onRejectInitiate: handleRejectInitiate,
    };
    if (loan.status === "IN_REVIEW") return <PendingCommodityLoanModal {...commonProps} onApproveInitiate={handleApproveInitiate} />;
    if (approvedTopup)
      return (
        <ApprovedAssetTopupModal
          {...commonProps}
          canDisburse={userRole === "SUPER_ADMIN"}
          loading={disburseAssetTopup.isPending}
          onConfirmDisbursement={async () => {
            await disburseAssetTopup.mutateAsync();
            handleOpen(false);
          }}
        />
      );
    else if (approvedLoan)
      return (
        <ApprovedCommodityLoanModal
          {...commonProps}
          canDisburse={userRole === "SUPER_ADMIN"}
          onConfirmDisbursement={onConfirmDisbursement}
          loading={disburseLoan.isPending}
        />
      );
    return <CommodityLoanDetails {...commonProps} />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon={icons.view} size={12} className="mr-1" />
            View
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px] rounded-lg">
        {renderCurrentModal(loan)}
        {loan && (
          <>
            <RejectConfirmationModal
              loan={loan}
              isOpen={isRejectConfirmationOpen}
              onOpenChange={setIsRejectConfirmationOpen}
              onConfirmReject={handleConfirmReject}
              loading={rejecting}
            />
            <CommodityLoanApprovalModal
              assetName={loan.name}
              isOpen={isApproveConfirmationOpen}
              onOpenChange={setIsApproveConfirmationOpen}
              onSubmit={handleConfirmApprove}
              isSubmitting={approveLoan.isPending}
              borrowerId={loan.borrower.id}
              closeMain={handleCloseMainModal}
              kind={loan.kind}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
