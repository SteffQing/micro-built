"use client";

import { useState, type JSX, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Icon, icons } from "@/components/icon";
import { getPaymentInflowStateBadge } from "@/config/status";
import { getRepaymentInfo, getRepaymentProof } from "@/lib/queries/admin/repayment";
import { capitalize, formatCurrency, formatPeriodLabel } from "@/lib/utils";
import { StatusPill, formatDate } from "@/ui/repayments/admin-repayments-view/paged-table-card";
import { ManualResolution } from "./manual-resolution-ui";
import { RepaymentDetailsModal } from "./repayment-breakdown";

type Props = { id: string; trigger?: JSX.Element };

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <div className="min-w-0 break-words text-right text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

function isImageUrl(url: string) {
  try {
    return /\.(jpe?g|png|webp|gif)$/.test(new URL(url).pathname.toLowerCase());
  } catch {
    return false;
  }
}

/** The signed link lives 5 minutes, so it is only requested once the admin asks for it. */
function ProofSection({ id }: { id: string }) {
  const [requested, setRequested] = useState(false);
  const { data, isLoading, error } = useQuery({ ...getRepaymentProof(id), enabled: requested });
  const url = data?.data?.url;

  if (!requested) {
    return (
      <Button variant="outline" size="sm" className="w-fit text-xs" onClick={() => setRequested(true)}>
        <Icon icon={icons.file} size={12} className="mr-1" />
        View proof of payment
      </Button>
    );
  }
  if (isLoading) {
    return (
      <p className="flex items-center text-sm text-muted-foreground">
        <Icon icon={icons.loaderCircle} size={16} className="mr-2 animate-spin" />
        Loading proof…
      </p>
    );
  }
  if (error || !url) return <p className="text-sm text-destructive">Failed to load proof. Please try again.</p>;
  if (isImageUrl(url)) {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Proof of payment" className="max-h-[40vh] w-full object-contain" />
      </div>
    );
  }
  return (
    <Button asChild variant="outline" size="sm" className="w-fit text-xs">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Icon icon={icons.file} size={12} className="mr-1" />
        Open proof (PDF)
      </a>
    </Button>
  );
}

// The API returns createdAt on the single-inflow response; the shared DTO type does not declare it yet.
function Body({ inflow, onClose }: { inflow: SingleRepaymentWithUserDto; onClose: () => void }) {
  const { customer } = inflow;
  const notes = inflow.history.filter((h) => h.note);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Inflow Details</DialogTitle>
      </DialogHeader>
      <Separator className="bg-border" />
      <div className={`${dialogBodyClass} min-w-0`}>
        <Row title="Source">{capitalize(inflow.source.toLowerCase())}</Row>
        <Row title="State">
          <StatusPill {...getPaymentInflowStateBadge(inflow.state)} />
        </Row>
        <Row title="Amount received">{formatCurrency(inflow.amount)}</Row>
        <Row title="Amount applied">{formatCurrency(inflow.applied)}</Row>
        <Row title="Unapplied">{formatCurrency(inflow.unapplied)}</Row>
        <Row title="Period">{formatPeriodLabel(inflow.period)}</Row>
        <Row title="Received">{formatDate(inflow.createdAt)}</Row>
        <Row title="Customer">
          {customer ? (
            <>
              {customer.name}
              {customer.externalId && (
                <span className="block text-xs font-normal text-muted-foreground">IPPIS {customer.externalId}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Unlinked</span>
          )}
        </Row>
        {inflow.externalUserId && <Row title="Staff ID">{inflow.externalUserId}</Row>}
        {inflow.uploadId && <Row title="Upload ref">{inflow.uploadId.slice(0, 8)}</Row>}
        {inflow.deduction && <Row title="Expected deduction">{formatCurrency(inflow.deduction.expected)}</Row>}
        {inflow.repayment && (
          <Row title="Applied as">
            <span className="block text-xs font-normal text-muted-foreground">
              Principal {formatCurrency(inflow.repayment.principal)} · Interest{" "}
              {formatCurrency(inflow.repayment.interest)}
              {inflow.repayment.penalty > 0 && <> · Penalty {formatCurrency(inflow.repayment.penalty)}</>}
            </span>
            {/* The repayment this inflow generated: its split, loan and deduction. */}
            <RepaymentDetailsModal
              from="inflow"
              repayment={{
                ...inflow.repayment,
                paymentInflowId: inflow.id,
                source: inflow.source,
                deductionId: inflow.deduction?.id ?? null,
                periodLabel: inflow.period,
                customer: inflow.customer,
              }}
              trigger={
                <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs">
                  View repayment <Icon icon={icons.chevronRight} size={12} />
                </Button>
              }
            />
          </Row>
        )}

        {notes.length > 0 && (
          <>
            <Separator className="bg-border" />
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            {notes.map((h, i) => (
              <p key={i} className="break-words text-sm">
                <span className="text-muted-foreground">{h.action}</span> — {h.note}
              </p>
            ))}
          </>
        )}

        {inflow.source === "LIQUIDATION" && inflow.hasProof && (
          <>
            <Separator className="bg-border" />
            <ProofSection id={inflow.id} />
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="flex-1 bg-muted text-sm font-medium text-muted-foreground">
            Close
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}

/** Read-only view of one payment inflow. A payroll row under review opens the resolution form instead. */
export function InflowDetailsModal({ id, trigger }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, error } = useQuery({ ...getRepaymentInfo(id), enabled: isOpen });
  const inflow = data?.data;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon={icons.view} size={12} className="mr-1" />
            View
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-[460px]">
        {isLoading ? (
          <>
            <DialogHeader>
              <DialogTitle>Loading inflow…</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center px-4 pb-8 sm:px-5">
              <Icon icon={icons.loaderCircle} size={32} className="animate-spin text-muted-foreground" />
            </div>
          </>
        ) : error ? (
          <>
            <DialogHeader>
              <DialogTitle>Error</DialogTitle>
            </DialogHeader>
            <p className="break-words px-4 pb-4 text-center text-destructive sm:px-5 sm:pb-5">{error.message}</p>
          </>
        ) : inflow?.state === "REVIEWING" ? (
          <ManualResolution repayment={inflow} isOpen={isOpen} onOpenChange={setIsOpen} />
        ) : inflow ? (
          <Body inflow={inflow} onClose={() => setIsOpen(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
