"use client";

import { Card } from "@/components/ui/card";
import { Icon, icons } from "@/components/icon";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { customerLoanSummary } from "@/lib/queries/admin/customer";
import { cn, formatCurrency, formatPeriodLabel } from "@/lib/utils";
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
import { AccountOfficerField } from "./account-officer-field";
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
            fallbackClassName="bg-muted text-muted-foreground text-lg"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate font-semibold text-foreground">{name}</h1>
            {status === "ACTIVE" && (
              <Tooltip>
                <TooltipTrigger aria-label="Verified account" className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <Icon icon={icons.badgeCheck} size={16} className="shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top">Verified account</TooltipContent>
              </Tooltip>
            )}
          </div>
          <button
            type="button"
            onClick={copyId}
            className="mt-0.5 flex max-w-full items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="truncate">{customer.id}</span>
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
            <span className="truncate">{customer.phoneNumber ?? "Not set"}</span>
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

      <RepaymentRate rate={customer.repaymentRate} />
      <AccountOfficerField
        customerId={customer.id}
        officer={customer.accountOfficer}
        canAssign={adminRole === "SUPER_ADMIN"}
      />

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

/** Share of closed payroll months paid in full, as a labelled bar coloured by health. */
function RepaymentRate({ rate }: { rate: number }) {
  const value = Math.max(0, Math.min(100, Math.round(rate)));
  const tone = value >= 80 ? "success" : value >= 50 ? "warning" : "destructive";
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">Repayment rate</span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "destructive" && "text-destructive"
          )}
        >
          {value}%
        </span>
      </div>
      <div
        role="meter"
        aria-label="Repayment rate"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "destructive" && "bg-destructive"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
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
            <TooltipTrigger aria-label={`About ${label}`} className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
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

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function openRequestsHint(open: UserLoanSummaryDto["openRequests"] | undefined): string {
  if (!open?.total) return "No loan, top-up or asset requests waiting";
  return `Waiting for a decision or payout: ${plural(open.loans, "loan request")}, ${plural(open.topups, "top-up")}, ${plural(open.assets, "asset request")}`;
}

export function LoanSummary({ id }: { id: string; name?: string }) {
  const { data, isLoading } = useQuery(customerLoanSummary(id));
  const summary = data?.data;

  if (isLoading) return <LoanSummarySkeleton />;

  return (
    <Card className="h-full gap-0 bg-background p-0">
      <div className="flex items-center justify-between gap-2 px-4 py-4 sm:px-5">
        <h2 className="font-semibold text-foreground">Loan Summary</h2>
        <FullBreakdownModal
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

      <div className="@container flex-1 border-t border-border">
        <div className="grid h-full grid-cols-2 gap-px bg-border @xl:grid-cols-4 [&>*]:bg-background">
          <Quadrant
            value={formatCurrency(Math.max(summary?.outstanding ?? 0, 0))}
            label="Outstanding Balance"
            hint="Everything the customer still owes across active advances, including unpaid penalties"
          />
          <Quadrant value={formatCurrency(summary?.totalBorrowed ?? 0)} label="Total Borrowed" />
          <Quadrant value={formatCurrency(summary?.totalRepaid ?? 0)} label="Total Repaid" />
          <Quadrant
            value={formatCurrency(summary?.penaltyCharged ?? 0)}
            label="Total Penalties"
            hint="All penalties charged to the customer, whether paid or still outstanding"
          />
          <Quadrant
            value={summary?.monthlyDeduction == null ? "—" : formatCurrency(summary.monthlyDeduction)}
            label="Monthly Deduction"
            hint="What payroll is asked to deduct next month for the running loan"
          />
          <Quadrant
            value={summary?.monthsLeft == null ? "—" : `${summary.monthsLeft} ${summary.monthsLeft === 1 ? "month" : "months"}`}
            label="Months Left"
            hint="Deductions still to come on the running loan"
          />
          <Quadrant
            value={formatPeriodLabel(summary?.nextDeductionPeriod)}
            label="Next Deduction"
            hint="The payroll month the next deduction is for"
          />
          <Quadrant
            value={(summary?.openRequests?.total ?? 0).toString()}
            label="Open Requests"
            hint={openRequestsHint(summary?.openRequests)}
          />
        </div>
      </div>
    </Card>
  );
}
