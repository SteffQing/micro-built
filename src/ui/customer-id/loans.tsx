"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Info,
  Plus,
} from "lucide-react";
import { formatDate } from "date-fns";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { capitalize, cn, formatCurrency } from "@/lib/utils";
import {
  customerLoans,
  repaymentAuditTrail,
  repaymentObligation,
  repaymentPlanHistory,
} from "@/lib/queries/admin/customer";
import {
  ActiveLoansSkeleton,
  PendingApplicationsSkeleton,
} from "./skeletons/loans";
import { CashLoanModal, CommodityLoanModal } from "../modals";
import LoanTopupModal from "../modals/loan-topup";
import LiquidationRequestModal from "../modals/customer-actions/liquidation-request";
import TenureChangeModal from "../modals/tenure-change";
import { EmptyState } from "./empty-state";

const LOANS_PER_PAGE = 2;

function DetailRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate text-sm text-[#999]">{label}</p>
        {hint && (
          <Tooltip>
            <TooltipTrigger>
              <Info className="size-3.5 cursor-pointer text-[#999]" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">
              <p>{hint}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function ActiveLoans({
  id,
  name,
  active,
}: {
  id: string;
  name: string;
  active: ActiveLoanDto[];
}) {
  const [page, setPage] = useState(0);
  const { data: obligationResponse } = useQuery(repaymentObligation(id));
  const obligation = obligationResponse?.data;
  const { data: historyResponse } = useQuery(
    repaymentPlanHistory(obligation?.id ?? ""),
  );
  const { data: auditResponse } = useQuery(
    repaymentAuditTrail(obligation?.id ?? ""),
  );
  const planHistory = historyResponse?.data ?? [];
  const auditTrail = auditResponse?.data ?? [];
  const totalPages = Math.ceil(active.length / LOANS_PER_PAGE);
  const paginated = active.slice(
    page * LOANS_PER_PAGE,
    page * LOANS_PER_PAGE + LOANS_PER_PAGE
  );
  const totalOutstanding = active.reduce(
    (sum, loan) => sum + (loan.amountOwed ?? 0),
    0
  );

  return (
    <Card className="h-full gap-0 bg-background p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-foreground">Active Loans</h2>
          <span className="flex size-5 items-center justify-center rounded-full bg-[#9f0808] text-[10px] font-semibold text-white">
            {active.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {active.length > 0 && (
            <TenureChangeModal
              borrowerId={id}
              trigger={
                <Button size="sm" variant="outline">
                  Change tenure
                </Button>
              }
            />
          )}
          <LiquidationRequestModal
            userId={id}
            name={name}
            amountOwed={totalOutstanding}
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="border-[#FFE1E0] text-sm font-medium text-[#8A0806] hover:bg-[#fff7f7] hover:text-[#8A0806]"
              >
                Liquidate
              </Button>
            }
          />
          <LoanTopupModal
            userId={id}
            trigger={
              <Button
                size="sm"
                className="gap-1.5 btn-gradient text-sm font-medium text-white"
              >
                <Plus className="size-4" />
                Top-up Loan
              </Button>
            }
          />
        </div>
      </div>
      <Separator className="bg-[#eee]" />

      <div className="p-4 sm:p-5">
        {obligation?.currentPlan && (
          <div className="mb-5 rounded-lg border border-[#ead7d7] bg-[#fffafa] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Consolidated repayment obligation
                </p>
                <p className="text-xs text-[#777]">
                  Plan v{obligation.currentPlan.version} · one payroll deduction across all advances
                </p>
              </div>
              <span className="rounded-full bg-[#f4dddd] px-2.5 py-1 text-xs font-medium text-[#8A0806]">
                {obligation.status}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailRow label="Contractual balance" value={formatCurrency(obligation.contractualOutstanding)} />
              <DetailRow label="Penalty balance" value={formatCurrency(obligation.penaltyOutstanding)} />
              <DetailRow label="Monthly deduction" value={formatCurrency(obligation.currentPlan.scheduledMonthly)} />
              <DetailRow label="Plan tenure" value={`${obligation.currentPlan.termMonths} Months`} />
            </div>
          </div>
        )}
        {active.length === 0 ? (
          <EmptyState
            title="No active loans"
            description="This user has no active loan running."
            className="py-16"
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {paginated.map((loan) => (
                <div
                  key={loan.id}
                  className="flex flex-col gap-4 rounded-lg border border-[#eee] p-4"
                >
                  <DetailRow label="Loan ID" value={loan.id} />
                  <Separator className="bg-[#F5F5F5]" />
                  <DetailRow
                    label="Loan Principal"
                    value={formatCurrency(loan.amount)}
                  />
                  <DetailRow label="Advance type" value={loan.type === "Topup" ? "Top-up" : "Initial"} />
                  <DetailRow label="Category" value={capitalize(loan.category.replace(/_/g, " "))} />
                  {loan.asset && <DetailRow label="Asset" value={loan.asset.name} />}
                  <DetailRow label="Original tenure" value={`${loan.tenure} Months`} />
                  <DetailRow
                    label="Repaid Amount"
                    value={formatCurrency(loan.amountRepaid)}
                  />
                  <DetailRow
                    label="Balance"
                    value={formatCurrency(loan.amountOwed)}
                    hint="Outstanding balance left to repay on this loan"
                  />
                  <Separator className="bg-[#F5F5F5]" />
                  <CashLoanModal
                    id={loan.id}
                    trigger={
                      <Button
                        variant="outline"
                        className="w-full border-[#FFE1E0] bg-transparent text-sm font-normal text-[#8A0806] hover:bg-[#fff7f7] hover:text-[#8A0806]"
                      >
                        See Loan Details
                      </Button>
                    }
                  />
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-5">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to page ${i + 1}`}
                    onClick={() => setPage(i)}
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      i === page ? "bg-[#9f0808]" : "bg-[#e0e0e0]"
                    )}
                  />
                ))}
              </div>
            )}

            {(planHistory.length > 0 || auditTrail.length > 0) && (
              <div className="mt-6 grid gap-4 border-t border-[#eee] pt-5 lg:grid-cols-2">
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Plan & tenure history</h3>
                  <div className="space-y-2">
                    {planHistory.map((plan) => (
                      <div key={plan.id} className="rounded-lg border border-[#eee] p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Plan v{plan.version} · {capitalize(plan.reason.replace(/_/g, " "))}</span>
                          <span className="text-xs text-[#777]">{plan.status}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#777]">
                          {plan.termMonths} months · {formatCurrency(plan.scheduledMonthly)}/month · balance {formatCurrency(plan.scheduledBalance)}
                        </p>
                        <p className="mt-1 text-xs text-[#999]">
                          Effective {formatDate(new Date(plan.effectiveFromPeriod), "d MMM yyyy")}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Obligation activity</h3>
                  <div className="space-y-2">
                    {auditTrail.slice().reverse().slice(0, 8).map((event) => (
                      <div key={event.id} className="flex gap-3 rounded-lg border border-[#eee] p-3">
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-[#9f0808]" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{capitalize(event.type.replace(/_/g, " "))}</p>
                          <p className="text-xs text-[#999]">
                            {formatDate(new Date(event.recordedAt), "d MMM yyyy, h:mm a")} · {event.actorId ?? event.actorType}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export function PendingApplications({ pending }: { pending: PendingLoanDto[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(pending.length / LOANS_PER_PAGE);
  const paginated = pending.slice(
    page * LOANS_PER_PAGE,
    page * LOANS_PER_PAGE + LOANS_PER_PAGE
  );

  return (
    <Card className="flex h-full flex-col gap-0 bg-background p-0">
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">Loan Applications</h2>
          <span className="text-xs text-[#777]">{pending.length} total</span>
        </div>
      </div>
      <Separator className="bg-[#eee]" />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {pending.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No pending loan applications"
            description="This user has no pending or approved loan applications."
            className="flex-1 py-16"
          />
        ) : (
          <div className="space-y-4">
            {paginated.map((application) => (
              <div
                key={application.id}
                className="flex flex-col gap-3 rounded-lg border border-[#eee] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-1">
                    <span className="h-1 w-6 rounded-[2px] bg-[#ECF100]" />
                    <span className="h-1 w-6 rounded-[2px] bg-[#CDFFD8]" />
                    <span className="h-1 w-6 rounded-[2px] bg-[#FFCBCB]" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#999]">
                    <span className="size-1.5 rounded-full bg-[#666]" />
                    {formatDate(application.date, "d MMM, yyyy")}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-[#666]">
                    {application.asset?.name ?? capitalize(application.category.replace(/_/g, " "))}
                  </p>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    application.status === "APPROVED"
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-700",
                  )}>
                    {application.status === "APPROVED" ? "Awaiting disbursement" : "Pending review"}
                  </span>
                </div>
                <p className="text-xs text-[#999]">
                  {application.type === "Topup" ? "Top-up advance" : "Initial advance"}
                  {application.tenure ? ` · ${application.tenure} months` : ""}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="truncate text-lg font-semibold tabular-nums text-[#9f0808] sm:text-xl">
                    {application.amount === null
                      ? "Amount set at approval"
                      : formatCurrency(application.amount)}
                  </p>
                  {application.recordType === "COMMODITY_REQUEST" ? (
                    <CommodityLoanModal id={application.detailsId} />
                  ) : (
                    <CashLoanModal
                      id={application.detailsId}
                      trigger={
                        <button
                          type="button"
                          className="flex shrink-0 cursor-pointer items-center gap-0.5 whitespace-nowrap text-xs text-[#999] hover:text-foreground"
                        >
                          See loan details
                          <ChevronRight className="size-4" />
                        </button>
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-0 text-[#999] hover:bg-transparent hover:text-foreground disabled:opacity-40"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-[#e0e0e0] text-white">
              <ChevronLeft className="size-3.5" />
            </span>
            Prev
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-0 text-[#9f0808] hover:bg-transparent hover:text-[#9f0808] disabled:opacity-40"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
            <span className="flex size-5 items-center justify-center rounded-full bg-[#9f0808] text-white">
              <ChevronRight className="size-3.5" />
            </span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function LoansWrapper({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const { data, isLoading } = useQuery(customerLoans(id));

  const activeLoans = data?.data?.activeLoans ?? [];
  const applications = data?.data?.applications ?? data?.data?.pendingLoans ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {isLoading ? (
          <ActiveLoansSkeleton />
        ) : (
          <ActiveLoans id={id} name={name} active={activeLoans} />
        )}
      </div>
      {isLoading ? (
        <PendingApplicationsSkeleton />
      ) : (
        <PendingApplications pending={applications} />
      )}
    </div>
  );
}
