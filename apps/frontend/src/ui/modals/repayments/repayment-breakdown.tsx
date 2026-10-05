"use client";

import { useState, type JSX, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Icon, icons } from "@/components/icon";
import { capitalize, cn, formatCurrency, formatPeriodLabel } from "@/lib/utils";
import { formatDate } from "@/ui/repayments/admin-repayments-view/paged-table-card";
import { InflowDetailsModal } from "./inflow-details";
import { DeductionDetailsModal } from "./deduction-details";

/** What the repayment modal needs; an applied-repayments row has all of it. */
export type RepaymentView = Pick<
  AppliedRepaymentListItemDto,
  "id" | "loanId" | "paymentInflowId" | "source" | "amount" | "principal" | "interest" | "penalty" | "deductionId" | "createdAt"
> & {
  periodLabel: string;
  customer: { name: string; externalId: string | null } | null;
};

const PARTS = [
  { key: "principal", label: "Principal", bar: "bg-chart-2" },
  { key: "interest", label: "Interest", bar: "bg-success" },
  { key: "penalty", label: "Penalty", bar: "bg-destructive" },
] as const;

/**
 * Where a payment went: penalties first, then interest and principal in the ratio they were booked
 * (the ledger's ratio method). Shared by the repayment and deduction modals.
 */
export function SplitBreakdown({ principal, interest, penalty }: { principal: number; interest: number; penalty: number }) {
  const values = { principal, interest, penalty };
  const total = principal + interest + penalty;
  return (
    <div className="space-y-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        {PARTS.map((part) =>
          values[part.key] > 0 ? (
            <div key={part.key} className={part.bar} style={{ width: `${(values[part.key] / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {PARTS.map((part) => (
          <div key={part.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 shrink-0 rounded-full", part.bar)} />
              {part.label}
            </dt>
            <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(values[part.key])}
            </dd>
            <dd className="text-[11px] text-muted-foreground tabular-nums">
              {total > 0 ? `${((values[part.key] / total) * 100).toFixed(1)}%` : "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <div className="min-w-0 break-words text-right text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

const linkButton = "h-8 gap-1.5 text-xs";

/**
 * One payment applied to a loan and how it was split. Links back to the inflow it came from and the
 * deduction it paid; `from` hides the link to the modal it was opened from, so dialogs don't nest in a loop.
 */
export function RepaymentDetailsModal({
  repayment,
  trigger,
  from,
}: {
  repayment: RepaymentView;
  trigger?: JSX.Element;
  from?: "inflow" | "deduction";
}) {
  const [open, setOpen] = useState(false);
  const r = repayment;
  const showInflow = from !== "inflow";
  const showDeduction = Boolean(r.deductionId) && from !== "deduction";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon={icons.view} size={12} className="mr-1" />
            View
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Repayment</DialogTitle>
          <DialogDescription>
            {formatPeriodLabel(r.periodLabel)} · {capitalize(r.source.toLowerCase())}
          </DialogDescription>
        </DialogHeader>
        <Separator className="bg-border" />
        <div className={`${dialogBodyClass} min-w-0`}>
          <div>
            <p className="text-xs text-muted-foreground">Applied to the loan</p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(r.amount)}</p>
          </div>

          <SplitBreakdown principal={r.principal} interest={r.interest} penalty={r.penalty} />
          <p className="text-xs leading-5 text-muted-foreground">
            Penalties are paid first; the rest splits between interest and principal in the ratio they were booked on
            the loan.
          </p>

          <Separator className="bg-border" />
          {r.customer && (
            <Row title="Customer">
              {r.customer.name}
              {r.customer.externalId && (
                <span className="block text-xs font-normal text-muted-foreground">IPPIS {r.customer.externalId}</span>
              )}
            </Row>
          )}
          <Row title="Loan">{r.loanId}</Row>
          <Row title="Applied">{formatDate(r.createdAt)}</Row>

          {(showInflow || showDeduction) && (
            <div className="flex flex-wrap gap-2">
              {showInflow && (
                <InflowDetailsModal
                  id={r.paymentInflowId}
                  trigger={
                    <Button variant="outline" size="sm" className={linkButton}>
                      <Icon icon={icons.moneyReceive} size={14} /> View inflow
                    </Button>
                  }
                />
              )}
              {showDeduction && r.deductionId && (
                <DeductionDetailsModal
                  id={r.deductionId}
                  trigger={
                    <Button variant="outline" size="sm" className={linkButton}>
                      <Icon icon={icons.calendar} size={14} /> View deduction
                    </Button>
                  }
                />
              )}
            </div>
          )}
          {!r.deductionId && (
            <p className="text-xs text-muted-foreground">Not tied to a monthly deduction (e.g. a liquidation or an imported balance).</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 bg-muted text-sm font-medium text-muted-foreground">
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
