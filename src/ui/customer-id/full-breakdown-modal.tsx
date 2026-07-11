"use client";

import { type ReactNode } from "react";
import { BadgeInfo } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils";
import LiquidationRequestModal from "../modals/customer-actions/liquidation-request";
import LoanTopupModal from "../modals/loan-topup";

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#eee] px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-1">
        <span className="text-sm text-[#999]">{label}</span>
        {hint && (
          <Tooltip>
            <TooltipTrigger>
              <BadgeInfo className="ml-0.5 size-3.5 cursor-pointer text-[#999]" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">
              <p>{hint}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default function FullBreakdownModal({
  userId,
  name,
  summary,
  trigger,
}: {
  userId: string;
  name: string;
  summary?: UserLoanSummaryDto | null;
  trigger: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-[500px]">
        <DialogHeader className="px-6 py-5">
          <DialogTitle className="text-lg font-semibold">
            Full Breakdown
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">
          <div className="rounded-xl bg-[#fafafa]">
            <Row
              label="Total Loan Amount"
              value={formatCurrency(summary?.totalLoanAmount ?? 0)}
              hint="Turnover: amount disbursed + management fee + interest booked"
            />
            <Row
              label="Amount Disbursed"
              value={formatCurrency(summary?.totalDisbursed ?? 0)}
              hint="Cash actually paid out — principal minus management fee"
            />
            <Row
              label="Outstanding Balance"
              value={formatCurrency(Math.max(summary?.outstanding ?? 0, 0))}
              hint="Total loan amount minus total repaid, excluding penalties"
            />
            <Row
              label="Management Fee"
              value={formatCurrency(summary?.managementFee ?? 0)}
            />
            <Row
              label="Interest Earned"
              value={formatCurrency(summary?.interestEarned ?? 0)}
              hint="Interest booked on all loans, collected or not"
            />
            <Row
              label="Interest Received"
              value={formatCurrency(summary?.interestReceived ?? 0)}
              hint="Interest actually collected from repayments"
            />
            <Row
              label="Penalties Received"
              value={formatCurrency(summary?.penaltiesReceived ?? 0)}
              hint="Penalty charges actually collected"
            />
            <Row
              label="Active/Pending Loans"
              value={`${summary?.activeLoansCount ?? 0}/${summary?.pendingLoansCount ?? 0}`}
            />
            <Row
              label="Last Repayment"
              value={summary?.lastRepaymentPeriod ?? "None yet"}
              hint="Period of the most recent repayment received from this customer"
            />
          </div>

          <Separator className="my-5" />

          <div className="flex flex-col gap-3">
            <LiquidationRequestModal
              userId={userId}
              name={name}
              amountOwed={summary?.currentOverdue ?? 0}
            />
            <LoanTopupModal userId={userId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
