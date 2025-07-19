"use client";

import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Phone } from "lucide-react";
import { Icons } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { customerLoanSummary } from "@/lib/queries/admin/customer";
import { cn, formatCurrency } from "@/lib/utils";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import { CustomerPage } from "@/components/svg/customers";

export function CustomerProfileCard({
  avatar,
  name,
  status,
  ...customer
}: CustomerInfoDto) {
  return (
    <Card className="w-full py-0 rounded-[12px]">
      <CardContent className="p-3">
        <div className="space-y-2 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 py-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={avatar || "/woman.jpeg"} alt={name} />
              <AvatarFallback className="bg-blue-100 text-blue-700 text-lg">
                {name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              {" "}
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-semibold text-gray-900">{name}</h1>
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

            <div
              className={cn(
                "py-1 px-[10px] w-fit rounded-[4px] flex gap-2 items-center",
                getUserStatusColor(status)
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    getUserStatusColor(status)?.match(
                      /text-\[(#[0-9A-Fa-f]{6})\]/
                    )?.[1] || "transparent",
                }}
              />

              <p className="text-sm font-normal">{getUserStatusText(status)}</p>
            </div>
          </div>

          <div className="flex gap-4 justify-between items-center border border-[#F0F0F0] rounded-[4px] p-3">
            <div className="flex gap-1 items-center">
              <CustomerPage.deactivate_account />
              <p className="text-xs text-[#FF4141] font-normal">
                Deactivate Account
              </p>
            </div>
            <div className="flex gap-1 items-center">
              <CustomerPage.message_user />
              <p className="text-xs font-medium text-[#333333]">Message User</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LoanSummary({ id }: { id: string }) {
  const { data } = useQuery({
    ...customerLoanSummary(id),
  });
  const loanSummary = data?.data;
  console.log(loanSummary);
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Loan Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative space-y-2 rounded-xl  border-r-2 border-b-2 border-secondary p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>
              {formatCurrency(loanSummary?.totalBorrowed ?? 0)}
            </p>
            <p className="text-sm  text-muted-foreground">Total Loans</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-l-2 border-b-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>
              {formatCurrency(loanSummary?.totalOutstanding ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground">Total Loans</p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-r-2 border-t-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>
              {loanSummary?.defaultedRepaymentsCount ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">
              Defaulted Repayments
            </p>
          </div>

          <div className="relative space-y-2 rounded-lg  border-l-2 border-t-2 border-secondary  p-4">
            <div className="w-2 h-2 bg-primary rounded-full secondary absolute top-3 right-3"></div>

            <p className={`text-2xl font-semibold text-primary`}>
              {loanSummary?.flaggedRepaymentsCount ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">Flagged Repayments</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
