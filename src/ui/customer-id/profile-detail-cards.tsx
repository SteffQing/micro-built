"use client";

import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";
import { Icons } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { customerLoanSummary } from "@/lib/queries/admin/customer";
import { cn, formatCurrency } from "@/lib/utils";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import { CustomerPage } from "@/components/svg/customers";
import { LoanSummarySkeleton } from "./skeletons/profile";
import UserAvatarComponent from "../settings/user-settings-view/user-avatar";
import { updateCustomerStatus } from "@/lib/mutations/admin/customer";
import { Button } from "@/components/ui/button";
import { AdminMessageUserModal } from "../modals/message";

export function CustomerProfileCard({ avatar, name, status, ...customer }: CustomerInfoDto) {
  const { isPending, mutateAsync } = useMutation(updateCustomerStatus(customer.id));
  async function updateStatus() {
    const nextStatus: UserStatus = status === "ACTIVE" ? "FLAGGED" : status === "FLAGGED" ? "INACTIVE" : "ACTIVE";
    await mutateAsync({ status: nextStatus });
  }
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
          <div>
            {" "}
            <div className="flex items-center gap-2 mb-1">
              <h1 className=" font-semibold ">{name}</h1>
              {status === "ACTIVE" && <Icons.verified className="w-5 h-5" />}
            </div>
            <p className="text-sm text-primary">{customer.id}</p>
          </div>
        </div>
        <Separator />

        <div className="flex items-end gap-4 justify-between py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span className="text-sm">{customer.email ?? "Not set"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span className="text-sm">{customer.contact ?? "Not set"}</span>
            </div>
          </div>

          <div className={cn("py-1 px-[10px] w-fit rounded-[4px] flex gap-2 items-center", getUserStatusColor(status))}>
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: getUserStatusColor(status)?.match(/text-\[(#[0-9A-Fa-f]{6})\]/)?.[1] || "transparent",
              }}
            />

            <p className="text-sm font-normal">{getUserStatusText(status)}</p>
          </div>
        </div>

        <div className="flex gap-4 justify-between items-center border border-[#F0F0F0] rounded-[4px] p-3">
          <Button
            className=" bg-transparent border-0 outline-0 hover:bg-transparent shadow-none px-0"
            size="sm"
            onClick={updateStatus}
            loading={isPending}
          >
            <div className="flex gap-1 items-center">
              <CustomerPage.deactivate_account pathProps={{ ...(status === "INACTIVE" ? { fill: "#13E741" } : {}) }} />
              <p className={cn("text-xs text-[#FF4141] font-normal", status === "INACTIVE" && "text-[#13E741]")}>
                {status === "ACTIVE" ? "Flag" : status === "FLAGGED" ? "Deactivate" : "Activate"} Account
              </p>
            </div>
          </Button>
          <AdminMessageUserModal
            userId={customer.id}
            name={name}
            trigger={
              <div className="flex gap-1 items-center cursor-pointer">
                <CustomerPage.message_user />
                <p className="text-xs font-medium text-[#333333]">Message User</p>
              </div>
            }
          />
        </div>
      </div>
    </Card>
  );
}

export function LoanSummary({ id }: { id: string }) {
  const { data, isLoading } = useQuery(customerLoanSummary(id));
  const loanSummary = data?.data;
  console.log(loanSummary);
  return isLoading ? (
    <LoanSummarySkeleton />
  ) : (
    <Card className="w-full bg-background">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Loan Summary</CardTitle>
        <button>Liquidate</button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative space-y-2 rounded-xl  border-r-2 border-b-2 border-secondary p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>{formatCurrency(loanSummary?.totalBorrowed ?? 0)}</p>
            <p className="text-sm  text-muted-foreground">Total Borrowed</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-l-2 border-b-2 border-secondary p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>{formatCurrency(loanSummary?.totalOverdue ?? 0)}</p>
            <p className="text-sm text-muted-foreground">Total Overdue</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-r-2 border-t-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>{loanSummary?.defaultedRepaymentsCount ?? 0}</p>
            <p className="text-sm text-muted-foreground">Defaulted Repayments</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-l-2 border-t-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>{loanSummary?.flaggedRepaymentsCount ?? 0}</p>
            <p className="text-sm text-muted-foreground">Flagged Repayments</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
