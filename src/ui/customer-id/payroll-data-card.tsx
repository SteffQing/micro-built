"use client";

import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { customerPPI } from "@/lib/queries/admin/customer";
import { UserIdentitySection, UserPayrollPaymentSection } from "./user-info";

export default function PayrollDataCard({ id }: { id: string }) {
  const { data, isLoading } = useQuery(customerPPI(id));
  const ppi = data?.data;
  const payroll = ppi?.payroll;

  return (
    <Card className="h-full gap-0 bg-background p-0">
      <div className="px-4 py-4 sm:px-5">
        <h2 className="font-semibold text-foreground">Payroll Data</h2>
      </div>
      <Separator className="bg-[#eee]" />

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <p className="text-sm text-[#999]">Employment Details</p>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[#999]">IPPIS ID</span>
              <span className="text-sm font-medium text-foreground">
                {payroll?.userId ?? "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[#999]">Command (Employer)</span>
              <span className="max-w-50 text-right text-sm font-medium text-foreground">
                {payroll?.command ?? "Not set"}
              </span>
            </div>
          </div>
        )}

        <div className="mt-auto pt-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-10 w-full border-[#eee] text-sm font-normal text-[#666]"
                disabled={isLoading || !ppi}
              >
                See full details
              </Button>
            </DialogTrigger>
            <DialogContent className="gap-0 p-0 sm:max-w-[520px]">
              <DialogHeader className="px-6 py-5">
                <DialogTitle className="text-lg font-semibold">
                  Payroll &amp; Identity Details
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-6">
                <UserPayrollPaymentSection
                  payroll={ppi?.payroll ?? null}
                  paymentMethod={ppi?.paymentMethod ?? null}
                />
                {ppi?.payroll && ppi?.identity && (
                  <Separator className="bg-[#F5F5F5]" />
                )}
                <UserIdentitySection identity={ppi?.identity ?? null} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Card>
  );
}
