"use client";

import { type ReactNode } from "react";
import { Icon, icons } from "@/components/icon";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils";

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
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        {hint && (
          <Tooltip>
            <TooltipTrigger aria-label={`About ${label}`} className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <Icon icon={icons.badgeInfo} size={14} className="ml-0.5 cursor-pointer text-muted-foreground" />
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
  summary,
  trigger,
}: {
  summary?: UserLoanSummaryDto | null;
  trigger: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Full Breakdown
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="rounded-xl bg-muted">
            <Row
              label="Total Loan Amount"
              value={formatCurrency(summary?.totalLoanAmount ?? 0)}
              hint="Contractual total: amount disbursed + management fee + interest booked"
            />
            <Row
              label="Amount Disbursed"
              value={formatCurrency(summary?.totalDisbursed ?? 0)}
              hint="Cash or asset value actually advanced — approved principal minus the upfront management fee"
            />
            <Row
              label="Contractual Outstanding"
              value={formatCurrency(Math.max(summary?.outstanding ?? 0, 0))}
              hint="Total principal and booked interest still unpaid; penalties are shown separately"
            />
            <Row
              label="Management Fee"
              value={formatCurrency(summary?.managementFee ?? 0)}
              hint="Upfront fee withheld from the approved principal before payout"
            />
            <Row
              label="Interest Booked"
              value={formatCurrency(summary?.interestBooked ?? 0)}
              hint="Full contractual interest charged on disbursed loans, whether collected yet or not"
            />
            <Row
              label="Interest Received"
              value={formatCurrency(summary?.interestCollected ?? 0)}
              hint="Repayments actually allocated to interest after earlier balances and penalties in the payment waterfall"
            />
            <Row
              label="Penalties Received"
              value={formatCurrency(summary?.penaltyCollected ?? 0)}
              hint="Payments actually allocated to assessed penalty charges; zero when no penalty has been charged"
            />
            <Row
              label="Open Requests"
              value={`${summary?.openRequests?.total ?? 0}`}
              hint="Loan requests and top-ups not yet paid out, plus asset requests in review"
            />
            <Row
              label="Last Repayment"
              value={summary?.lastRepaymentPeriod ?? "None yet"}
              hint="Period of the most recent repayment received from this customer"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
