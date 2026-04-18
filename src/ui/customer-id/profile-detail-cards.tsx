"use client";

import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Mail, Phone, BadgeInfo } from "lucide-react";
import { Icons } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { customerLoanSummary } from "@/lib/queries/admin/customer";
import { cn, formatCurrency } from "@/lib/utils";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import { CustomerPage } from "@/components/svg/customers";
import { LoanSummarySkeleton } from "./skeletons/profile";
import UserAvatarComponent from "../settings/user-settings-view/user-avatar";
import AdminMessageUserModal from "../modals/customer-actions/message-customer";
import LiquidationRequestModal from "../modals/customer-actions/liquidation-request";
import RepaymentRateIndicator from "@/components/repayment-rate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ToggleUserStatus from "../modals/customer-actions/toggle-user-status";
import LoanTopupModal from "../modals/loan-topup";

export function CustomerProfileCard({
  name,
  status,
  flagReason,
  adminRole,
  ...customer
}: CustomerInfoDto & { adminRole: UserRole }) {
  return (
    <Card className="p-5  bg-background">
      <div className="space-y-2 flex flex-col justify-between h-full">
        <div className="flex items-center gap-2 py-4 ">
          <UserAvatarComponent
            id={customer.id}
            name={name}
            className="w-16 h-16"
            fallbackCN="bg-blue-100 text-blue-700 text-lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 w-full">
              <h1 className=" font-semibold truncate ">{name}</h1>
              <RepaymentRateIndicator rate={customer.repaymentRate} />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-primary font-mono">{customer.id}</p>
            </div>
          </div>
        </div>
        <Separator />

        <div className="flex flex-col gap-2 py-4">
          <div className="flex items-center justify-between gap-4">
            {status === "ACTIVE" ? (
              <div className="flex items-center gap-1.5 text-primary">
                <Icons.verified className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Verified Account</span>
              </div>
            ) : (
              <div />
            )}
            <div className={cn("py-1 px-[10px] w-fit rounded-[4px] flex items-center gap-2", getUserStatusColor(status))}>
              <span className="h-2 w-2 rounded-full bg-current shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-wider">{getUserStatusText(status)}</p>
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-muted-foreground w-full">
              <Mail className="w-4 h-4 shrink-0" />
              <span className="text-sm truncate block">{customer.email ?? "Not set"}</span>
            </div>
            <div className="flex items-center gap-2 w-full">
              <Phone className="w-4 h-4 shrink-0" />
              <span className="text-sm truncate block">{customer.contact ?? "Not set"}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-between items-center border border-border rounded-[4px] p-3">
          <ToggleUserStatus userId={customer.id} status={status} reason={flagReason} adminRole={adminRole} />
          <AdminMessageUserModal
            userId={customer.id}
            name={name}
            trigger={
              <div className="flex gap-1 items-center cursor-pointer">
                <CustomerPage.message_user />
                <p className="text-xs font-medium text-foreground">Message User</p>
              </div>
            }
          />
        </div>
      </div>
    </Card>
  );
}

export function LoanSummary({ id, name }: { id: string; name: string }) {
  const { data, isLoading } = useQuery(customerLoanSummary(id));
  const loanSummary = data?.data;

  return isLoading ? (
    <LoanSummarySkeleton />
  ) : (
    <Card className="w-full bg-background">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Loan Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative space-y-2 rounded-xl  border-r-2 border-b-2 border-secondary p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>
            <p className={`text-2xl font-semibold text-primary`}>
              {formatCurrency(Math.max(loanSummary?.currentOverdue ?? 0, 0))}
            </p>
            <div className="flex items-center gap-0.5">
              <p className="text-sm text-muted-foreground">Current Overdue</p>
              <Tooltip>
                <TooltipTrigger>
                  <BadgeInfo className="w-4 h-4 ml-1 text-muted-foreground cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-700 text-white p-2 rounded">
                  <p>Current total balance owed by the user from principal, to management fee and penalties</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="relative space-y-2 rounded-lg  border-l-2 border-b-2 border-secondary p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>
            <p className={`text-2xl font-semibold text-primary`}>{formatCurrency(loanSummary?.totalBorrowed ?? 0)}</p>
            <p className="text-sm  text-muted-foreground">Total Borrowed</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-r-2 border-t-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>{formatCurrency(loanSummary?.totalRepaid ?? 0)}</p>
            <p className="text-sm text-muted-foreground">Total Repaid</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-l-2 border-t-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>{formatCurrency(loanSummary?.totalPenalties ?? 0)}</p>
            <div className="flex items-center gap-0.5">
              <p className="text-sm text-muted-foreground">Total Penalties</p>
              <Tooltip>
                <TooltipTrigger>
                  <BadgeInfo className="w-4 h-4 ml-1 text-muted-foreground cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-700 text-white p-2 rounded">
                  <p>This includes paid and unpaid interests, includes penalties</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

        </div>
        <div className="w-full mt-4 flex flex-col gap-2">
          <LiquidationRequestModal userId={id} name={name} amountOwed={loanSummary?.currentOverdue ?? 0} />
          <LoanTopupModal userId={id} />
          {/* Needs fixing */}
        </div>
      </CardContent>
    </Card>
  );
}
