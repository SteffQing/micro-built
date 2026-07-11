"use client";

import { Card } from "@/components/ui/card";
import { BadgeInfo, ChevronRight, Copy, Mail, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { customerLoanSummary } from "@/lib/queries/admin/customer";
import { cn, formatCurrency } from "@/lib/utils";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import { Icons } from "@/components/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoanSummarySkeleton } from "./skeletons/profile";
import UserAvatarComponent from "../settings/user-settings-view/user-avatar";
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
    <Card className="h-full gap-0 bg-background p-5">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <UserAvatarComponent
            id={customer.id}
            name={name}
            className="size-14"
            fallbackCN="bg-blue-100 text-blue-700 text-lg"
          />
          <span className="absolute -right-1 -top-1 rounded-full border-2 border-background bg-[#E2FFE8] px-1.5 text-[10px] font-semibold text-[#13E741]">
            {customer.repaymentRate}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate font-semibold text-foreground">{name}</h1>
            {status === "ACTIVE" && (
              <Tooltip>
                <TooltipTrigger>
                  <Icons.verified className="size-4 shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top">Verified account</TooltipContent>
              </Tooltip>
            )}
          </div>
          <button
            type="button"
            onClick={copyId}
            className="mt-0.5 flex items-center gap-1.5 text-sm text-[#666] hover:text-foreground"
          >
            {customer.id}
            <Copy className="size-3.5 text-[#999]" />
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <Mail className="size-4 shrink-0 text-[#999]" />
            <span className="truncate">{customer.email ?? "Not set"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <Phone className="size-4 shrink-0 text-[#999]" />
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

      <div className="mt-5 flex items-center justify-between gap-2 rounded-lg border border-[#eee] p-1">
        <ToggleUserStatus
          userId={customer.id}
          status={status}
          reason={flagReason}
          adminRole={adminRole}
        />
        <div className="h-5 w-px shrink-0 bg-[#eee]" />
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
    <div className={cn("p-5", className)}>
      <p className="text-xl font-semibold text-[#9f0808]">{value}</p>
      <div className="mt-1 flex items-center gap-1">
        <p className="text-xs text-[#999]">{label}</p>
        {hint && (
          <Tooltip>
            <TooltipTrigger>
              <BadgeInfo className="size-3.5 cursor-pointer text-[#999]" />
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
  const summary = data?.data;

  if (isLoading) return <LoanSummarySkeleton />;

  return (
    <Card className="h-full gap-0 bg-background p-0">
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <h2 className="font-semibold text-foreground">Loan Summary</h2>
        <FullBreakdownModal
          userId={id}
          name={name}
          summary={summary}
          trigger={
            <button
              type="button"
              className="flex cursor-pointer items-center gap-0.5 text-xs text-[#999] hover:text-foreground"
            >
              See full details
              <ChevronRight className="size-4" />
            </button>
          }
        />
      </div>

      <div className="grid grid-cols-2">
        <Quadrant
          className="border-b border-r border-[#eee]"
          value={formatCurrency(Math.max(summary?.currentOverdue ?? 0, 0))}
          label="Current Overdue"
          hint="Current total balance owed by the user from principal, to management fee and penalties"
        />
        <Quadrant
          className="border-b border-[#eee]"
          value={formatCurrency(summary?.totalBorrowed ?? 0)}
          label="Total Borrowed"
        />
        <Quadrant
          className="border-r border-[#eee]"
          value={formatCurrency(summary?.totalRepaid ?? 0)}
          label="Total Repaid"
        />
        <Quadrant
          value={formatCurrency(summary?.totalPenalties ?? 0)}
          label="Total Penalties"
          hint="This includes paid and unpaid interests, includes penalties"
        />
      </div>
    </Card>
  );
}
