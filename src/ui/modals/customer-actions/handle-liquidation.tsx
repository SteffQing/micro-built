"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Eye, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  acceptLiquidation,
  rejectLiquidation,
} from "@/lib/mutations/admin/repayments";

export default function HandleLiquidation({
  id,
  amount,
  status,
  approvedAt,
}: CustomerLiquidationsRequestDto) {
  const [isOpen, setIsOpen] = useState(false);

  const acceptLiq = useMutation(acceptLiquidation(id));
  const rejectLiq = useMutation(rejectLiquidation(id));

  async function handleAccept() {
    await acceptLiq.mutateAsync();
    setIsOpen(false);
  }

  async function handleReject() {
    await rejectLiq.mutateAsync();
    setIsOpen(false);
  }

  const isPending = acceptLiq.isPending || rejectLiq.isPending;

  const handleOpen = (val: boolean) => {
    setIsOpen(val);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[450px] rounded-lg">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${getStatusColor(status)} rounded-full`}>
              {getStatusIcon(status)}
            </div>
            <DialogTitle className="text-lg font-semibold">
              {getStatusTitle(status)}
            </DialogTitle>
          </div>
        </DialogHeader>
        <Separator className="bg-[#F0F0F0]" />
        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Liquidation Amount</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(amount)}
            </p>
          </div>

          {approvedAt && (
            <div className="bg-green-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <span>Approved On</span>
              </div>
              <p className="text-lg font-semibold text-green-800">
                {new Date(approvedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}

          {status === "REJECTED" && (
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-700">
                This liquidation request has been rejected and cannot be
                processed.
              </p>
            </div>
          )}
        </section>{" "}
        <DialogFooter>
          {status === "PENDING" ? (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                loading={rejectLiq.isPending}
                disabled={isPending}
                className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
              >
                Reject
              </Button>
              <Button
                onClick={handleAccept}
                loading={acceptLiq.isPending}
                disabled={isPending}
                className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
              >
                Accept
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpen(false)}
              className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const getStatusIcon = (status: LiquidationStatus) => {
  switch (status) {
    case "PENDING":
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    case "APPROVED":
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case "REJECTED":
      return <XCircle className="h-5 w-5 text-red-600" />;
  }
};

const getStatusColor = (status: LiquidationStatus) => {
  switch (status) {
    case "PENDING":
      return "bg-yellow-50";
    case "APPROVED":
      return "bg-green-50";
    case "REJECTED":
      return "bg-red-50";
  }
};

const getStatusTitle = (status: LiquidationStatus) => {
  switch (status) {
    case "PENDING":
      return "Pending Liquidation";
    case "APPROVED":
      return "Approved Liquidation";
    case "REJECTED":
      return "Rejected Liquidation";
  }
};
