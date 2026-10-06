"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { customerPaymentMethod } from "@/lib/queries/admin/customer";
import { calculateDisbursementAmount } from "@/config/value-helpers";
import { getTotalPayment } from "@/config/logic";

interface ApprovedLoanModalProps {
  loan: CashLoan;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDisbursement: () => void;
  onRejectInitiate: () => void;
  loading: boolean;
  /** Only super admins disburse; anyone who can see it may reject it. */
  canDisburse: boolean;
}

const commodity = (asset: string) => `I can confirm that the ${asset} has been shipped out/about to be shipped out.`;

export function ApprovedLoanModal({
  loan,
  isOpen,
  onConfirmDisbursement,
  onRejectInitiate,
  loading,
  canDisburse,
}: ApprovedLoanModalProps) {
  const [disbursementConfirmed, setDisbursementConfirmed] = useState(false);
  const { data, isLoading } = useQuery(customerPaymentMethod(loan.borrower.id));

  const expectedAmount = getTotalPayment(loan.principal, loan.interestRate, loan.tenure);
  const disburseAmount = calculateDisbursementAmount(loan.principal, loan.managementFeeRate);
  const expectedInterestAmount = expectedAmount - loan.principal;

  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + loan.tenure);

  const handleConfirmDisbursementClick = () => {
    if (disbursementConfirmed) {
      onConfirmDisbursement();
    }
  };

  if (!isOpen) return null;

  return (
    <>
        <DialogHeader>
          <DialogTitle>Loan Disbursement</DialogTitle>
        </DialogHeader>
        <Separator className="bg-border" />

        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          {isLoading ? (
            <div className="grid gap-4 bg-muted rounded-[8px] p-4 sm:p-5 border border-border">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonDetail key={index} />
              ))}
            </div>
          ) : !data?.data ? (
            <p>Payment method not found!</p>
          ) : (
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold ">Payment Information</h3>
              <div className="grid gap-2 bg-muted rounded-[8px] p-4 sm:p-5 border border-border">
                <Detail title="Bank Name" content={data.data.bankName} />
                <Detail title="Account Name" content={data.data.accountName} />
                <Detail title="Account Number" content={data.data.accountNumber} />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold ">Loan Information</h3>
            <div className="grid gap-2 bg-muted rounded-[8px] p-4 sm:p-5 border border-border">
              <Detail title="Amount to Disburse" content={formatCurrency(disburseAmount)} />
              <Detail title="Expected Interest Amount" content={formatCurrency(expectedInterestAmount)} />
              <Detail title="Total Expected Amount" content={formatCurrency(expectedAmount)} />
              <Detail title="Due Date" content={formatDate(dueDate, "PPP")} />
            </div>
          </div>
          {canDisburse ? (
          <div className="flex items-start space-x-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <Checkbox
              id="disbursement-confirm"
              checked={disbursementConfirmed}
              onCheckedChange={(checked) => setDisbursementConfirmed(!!checked)}
              className="mt-0.5 border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
              disabled={!data?.data || loading}
            />
            <label
              htmlFor="disbursement-confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {loan.assets && loan.assets.length > 0
                ? commodity(loan.assets[0].name)
                : "I can confirm that the requested funds for this particular loan application has been disbursed to the account details provided by the customer."}
            </label>
          </div>
          ) : (
            <AwaitingSuperAdmin />
          )}
        </section>
        <ApprovedFooter
          onReject={onRejectInitiate}
          onDisburse={canDisburse ? handleConfirmDisbursementClick : undefined}
          confirmed={disbursementConfirmed}
          loading={loading}
        />
    </>
  );
}

interface Props {
  title: string;
  content: string;
}

function Detail({ title, content }: Props) {
  return (
    <div className="flex justify-between items-center gap-4">
      <p className="text-muted-foreground text-sm font-normal">{title}</p>
      <p className="min-w-0 break-words text-right text-sm font-medium">{content}</p>
    </div>
  );
}

interface CommodityLoanApprovalModalProps {
  loan: CommodityLoanDto;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDisbursement: () => void;
  onRejectInitiate: () => void;
  loading: boolean;
  canDisburse: boolean;
}

export function ApprovedCommodityLoanModal({
  loan,
  isOpen,
  onConfirmDisbursement,
  onRejectInitiate,
  loading,
  canDisburse,
}: CommodityLoanApprovalModalProps) {
  const [disbursementConfirmed, setDisbursementConfirmed] = useState(false);

  const loanData = loan.loan!;
  const expectedAmount = getTotalPayment(loanData.principal, loanData.interestRate, loanData.tenure);
  const expectedInterestAmount = expectedAmount - loanData.principal;

  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + loanData.tenure);

  const handleConfirmDisbursementClick = () => {
    if (disbursementConfirmed) {
      onConfirmDisbursement();
    }
  };

  if (!isOpen) return null;

  return (
    <>
        <DialogHeader>
          <DialogTitle>Confirm Asset Delivery</DialogTitle>
        </DialogHeader>
        <Separator className="bg-border" />

        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold ">Loan Information</h3>
            <div className="grid gap-2 bg-muted rounded-[8px] p-4 sm:p-5 border border-border">
              <Detail title="Commodity Loan Name" content={loan.name} />

              <Detail title="Asset Value (Financed)" content={formatCurrency(loanData.principal)} />
              <Detail title="Expected Interest Amount" content={formatCurrency(expectedInterestAmount)} />
              <Detail title="Total Expected Amount" content={formatCurrency(expectedAmount)} />
              <Detail title="Due Date" content={formatDate(dueDate, "PPP")} />
            </div>
          </div>
          {canDisburse ? (
          <div className="flex items-start space-x-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <Checkbox
              id="disbursement-confirm"
              checked={disbursementConfirmed}
              onCheckedChange={(checked) => setDisbursementConfirmed(!!checked)}
              className="mt-0.5 border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
              disabled={loading}
            />
            <label
              htmlFor="disbursement-confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I can confirm that the {loan.name} commodity has been shipped out/about to be shipped out to the customer.
            </label>
          </div>
          ) : (
            <AwaitingSuperAdmin />
          )}
        </section>
        <ApprovedFooter
          onReject={onRejectInitiate}
          onDisburse={canDisburse ? handleConfirmDisbursementClick : undefined}
          confirmed={disbursementConfirmed}
          loading={loading}
        />
    </>
  );
}

/**
 * An approved asset top-up: confirm the asset is on its way, then pay the top-up into the running loan (PATCH
 * /admin/loans/topups/:id/disburse), with the tenure change approved with it.
 */
export function ApprovedAssetTopupModal({
  loan,
  isOpen,
  onConfirmDisbursement,
  onRejectInitiate,
  loading,
  canDisburse,
}: {
  loan: CommodityLoanDto;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDisbursement: () => void;
  onRejectInitiate: () => void;
  loading: boolean;
  canDisburse: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  if (!isOpen || !loan.topup) return null;
  const { topup } = loan;
  const change = topup.tenureChange && topup.tenureChange.status !== "REJECTED" ? topup.tenureChange : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Disburse Asset Top-up</DialogTitle>
      </DialogHeader>
      <Separator className="bg-border" />
      <section className="grid gap-4 p-4 sm:gap-5 sm:p-5">
        <div className="grid gap-2 rounded-[8px] border border-border bg-muted p-4 sm:p-5">
          <Detail title="Asset" content={loan.name} />
          <Detail title="Customer" content={loan.borrower.name} />
          <Detail title="Top-up Amount" content={formatCurrency(topup.amount)} />
          <Detail title="Added to Loan" content={loan.loanId ?? "—"} />
          {loan.loan && <Detail title="Loan Outstanding Now" content={formatCurrency(loan.loan.outstanding)} />}
          <Detail
            title="Tenure Change"
            content={
              change
                ? `${change.monthsDelta > 0 ? "+" : ""}${change.monthsDelta} months${change.reprice ? ", interest recalculated" : ""}`
                : "None"
            }
          />
        </div>
        {canDisburse ? (
          <div className="flex items-start space-x-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <Checkbox
              id="topup-disbursement-confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(!!checked)}
              className="mt-0.5 border-destructive/50 data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
              disabled={loading}
            />
            <label htmlFor="topup-disbursement-confirm" className="text-sm font-medium leading-snug">
              I can confirm that the {loan.name} has been shipped out/about to be shipped out to the customer.
            </label>
          </div>
        ) : (
          <AwaitingSuperAdmin />
        )}
      </section>
      <ApprovedFooter
        onReject={onRejectInitiate}
        onDisburse={canDisburse ? () => confirmed && onConfirmDisbursement() : undefined}
        confirmed={confirmed}
        loading={loading}
      />
    </>
  );
}

function AwaitingSuperAdmin() {
  return <p className="text-sm text-muted-foreground">Approved. A super admin disburses it, or it can be rejected.</p>;
}

/** An approved loan or top-up isn't paid out yet: it can still be rejected, or (super admins) disbursed. */
function ApprovedFooter({
  onReject,
  onDisburse,
  confirmed,
  loading,
}: {
  onReject: () => void;
  /** Absent when the viewer can't disburse. */
  onDisburse?: () => void;
  confirmed: boolean;
  loading: boolean;
}) {
  return (
    <DialogFooter>
      <Button
        variant="outline"
        onClick={onReject}
        disabled={loading}
        className="flex-1 rounded-[8px] border-destructive/40 p-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        Reject
      </Button>
      {onDisburse && (
        <Button
          className="rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm flex-1 btn-gradient"
          onClick={onDisburse}
          loading={loading}
          disabled={!confirmed || loading}
        >
          Disburse
        </Button>
      )}
    </DialogFooter>
  );
}

function SkeletonDetail() {
  return (
    <div className="flex justify-between items-center gap-4 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="h-4 bg-muted rounded w-1/2" />
    </div>
  );
}
