"use client";

import { Card } from "@/components/ui/card";
import { Icon, icons } from "@/components/icon";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { customerLoanSummary, repaymentObligation } from "@/lib/queries/admin/customer";
import { cn, formatCurrency } from "@/lib/utils";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoanSummarySkeleton } from "./skeletons/profile";
import { UserAvatar } from "@/components/user-avatar";
import AdminMessageUserModal from "../modals/customer-actions/message-customer";
import ToggleUserStatus from "../modals/customer-actions/toggle-user-status";
import FullBreakdownModal from "./full-breakdown-modal";
import { CustomerPage } from "@/components/svg/customers";

export function CustomerProfileCard({
  name,
  status,
  flagReason,
  adminRole,
  ...customer
}: CustomerInfoDto & { adminRole: UserRole }) {
  const copyId = () => {
    navigator.clipboard.writeText(customer.id);
    toast.success("Customer ID copied");
  };

  return (
    <Card className="h-full gap-0 bg-background p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <UserAvatar
            id={customer.id}
            name={name}
            size={56}
            fallbackClassName="bg-blue-100 text-blue-700 text-lg"
          />
          <span className="absolute -right-1 -top-1 rounded-full border-2 border-background bg-success/10 px-1.5 text-[10px] font-semibold text-success">
            {customer.repaymentRate}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate font-semibold text-foreground">{name}</h1>
            {status === "ACTIVE" && (
              <Tooltip>
                <TooltipTrigger>
                  <Icon icon={icons.badgeCheck} size={16} className="shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top">Verified account</TooltipContent>
              </Tooltip>
            )}
          </div>
          <button
            type="button"
            onClick={copyId}
            className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {customer.id}
            <Icon icon={icons.copy} size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap-reverse items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon icon={icons.mail} size={16} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{customer.email ?? "Not set"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon icon={icons.phone} size={16} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{customer.contact ?? "Not set"}</span>
          </div>
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            getUserStatusColor(status)
          )}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-current" />
          {getUserStatusText(status)}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 rounded-lg border border-border p-1">
        <ToggleUserStatus
          userId={customer.id}
          status={status}
          reason={flagReason}
          adminRole={adminRole}
        />
        <div className="h-5 w-px shrink-0 bg-border" />
        <AdminMessageUserModal
          userId={customer.id}
          name={name}
          trigger={
            <button
              type="button"
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 text-xs font-medium text-foreground"
            >
              <CustomerPage.message_user />
              Message User
            </button>
          }
        />
      </div>
    </Card>
  );
}

function Quadrant({
  value,
  label,
  hint,
  className,
}: {
  value: string;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 p-4 sm:p-5", className)}>
      <p className="truncate text-lg font-semibold tabular-nums text-brand sm:text-xl">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-1">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {hint && (
          <Tooltip>
            <TooltipTrigger>
              <Icon icon={icons.badgeInfo} size={14} className="cursor-pointer text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">
              <p>{hint}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function LoanSummary({ id, name }: { id: string; name: string }) {
  const { data, isLoading } = useQuery(customerLoanSummary(id));
  const { data: obligationData, isLoading: obligationLoading } = useQuery(
    repaymentObligation(id),
  );
  const summary = data?.data;
  const plan = obligationData?.data?.currentPlan;

  if (isLoading || obligationLoading) return <LoanSummarySkeleton />;

  return (
    <Card className="h-full gap-0 bg-background p-0">
      <div className="flex items-center justify-between gap-2 px-4 py-4 sm:px-5">
        <h2 className="font-semibold text-foreground">Loan Summary</h2>
        <FullBreakdownModal
          userId={id}
          name={name}
          summary={summary}
          trigger={
            <button
              type="button"
              className="flex shrink-0 cursor-pointer items-center gap-0.5 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground"
            >
              See full details
              <Icon icon={icons.chevronRight} size={16} />
            </button>
          }
        />
      </div>

      <div className="grid grid-cols-2">
        <Quadrant
          className="border-b border-r border-border"
          value={formatCurrency(Math.max(summary?.currentOverdue ?? 0, 0))}
          label="Outstanding Balance"
          hint="Everything the customer still owes across active advances, including unpaid penalties"
        />
        <Quadrant
          className="border-b border-border"
          value={formatCurrency(summary?.totalBorrowed ?? 0)}
          label="Total Borrowed"
        />
        <Quadrant
          className="border-b border-r border-border"
          value={formatCurrency(summary?.totalRepaid ?? 0)}
          label="Total Repaid"
        />
        <Quadrant
          className="border-b border-border"
          value={formatCurrency(summary?.totalPenalties ?? 0)}
          label="Total Penalties"
          hint="All penalties charged to the customer, whether paid or still outstanding"
        />
        <Quadrant
          className="border-r border-border"
          value={plan ? `${plan.termMonths} Months` : "—"}
          label="Current Tenure"
          hint="The tenure currently used to spread future payroll deductions"
        />
        <Quadrant
          value={plan ? formatCurrency(plan.scheduledMonthly) : "—"}
          label="Current Monthly Deduction"
          hint="The amount currently scheduled for each payroll month"
        />
      </div>
    </Card>
  );
}
