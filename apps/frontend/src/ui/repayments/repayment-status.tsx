"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const descriptions: Record<RepaymentStatus, string> = {
  AWAITING:
    "An expected installment is awaiting a recorded payment. It remains pending while the repayment period is open.",
  FULFILLED:
    "The expected amount for this repayment record has been fully covered.",
  PARTIAL:
    "A payment has been recorded, but it is less than the expected amount. The remaining balance is still due.",
  FAILED:
    "No payment was recorded for this installment when the repayment period was closed. It needs follow-up.",
  MANUAL_RESOLUTION:
    "This payment needs an administrator to match it to the correct customer or loan before it can be applied.",
};

export function RepaymentStatusLabel({ status }: { status: RepaymentStatus }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="cursor-help rounded-sm text-left text-muted-foreground underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {status.replace(/_/g, " ")}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-72 text-left leading-5">
        {descriptions[status]}
      </TooltipContent>
    </Tooltip>
  );
}
