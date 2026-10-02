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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { formatCurrency } from "@/lib/utils";
import {
  acceptLiquidation,
  rejectLiquidation,
} from "@/lib/mutations/admin/repayments";
import { adminLiquidationProof } from "@/lib/queries/admin/customer";
import type { ReactNode } from "react";

type Props = {
  id: string;
  customerId: string;
  amount: number;
  status: LiquidationStatus;
  hasProof: boolean;
  trigger?: ReactNode;
};

function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(jpe?g|png|webp|gif)$/.test(pathname);
  } catch {
    return false;
  }
}

function getStatusIcon(status: LiquidationStatus) {
  switch (status) {
    case "PENDING":
      return (
        <Icon icon={icons.alertTriangle} size={20} className="text-warning" />
      );
    case "REVIEWING":
      return <Icon icon={icons.search} size={20} className="text-muted-foreground" />;
    case "APPROVED":
      return (
        <Icon icon={icons.checkCircle} size={20} className="text-success" />
      );
    case "REJECTED":
      return <Icon icon={icons.x} size={20} className="text-destructive" />;
  }
}

function getStatusColor(status: LiquidationStatus) {
  switch (status) {
    case "PENDING":
      return "bg-warning/10";
    case "REVIEWING":
      return "bg-muted";
    case "APPROVED":
      return "bg-success/10";
    case "REJECTED":
      return "bg-destructive/10";
  }
}

function getStatusTitle(status: LiquidationStatus) {
  switch (status) {
    case "PENDING":
      return "Pending Liquidation";
    case "REVIEWING":
      return "Liquidation Under Review";
    case "APPROVED":
      return "Approved Liquidation";
    case "REJECTED":
      return "Rejected Liquidation";
  }
}

export default function AdminLiquidationAction({
  id,
  customerId,
  amount,
  status,
  hasProof,
  trigger,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const acceptLiq = useMutation(acceptLiquidation(id));
  const rejectLiq = useMutation(rejectLiquidation(id));

  const { data: proofData, isLoading: proofLoading } = useQuery({
    ...adminLiquidationProof(customerId, id),
    enabled: isOpen && hasProof,
  });

  const isPending = acceptLiq.isPending || rejectLiq.isPending;
  const canAct = status === "PENDING" || status === "REVIEWING";

  const signedUrl = proofData?.data?.url ?? null;
  const isImage = signedUrl ? isImageUrl(signedUrl) : false;

  const handleOpen = (val: boolean) => {
    setIsOpen(val);
    if (!val) {
      setRejectNote("");
    }
  };

  async function handleAccept() {
    await acceptLiq.mutateAsync();
    setIsOpen(false);
  }

  async function handleReject() {
    await rejectLiq.mutateAsync({ note: rejectNote || undefined });
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon={icons.view} size={12} className="mr-1" />
            View
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] rounded-lg">
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

        <Separator className="bg-border" />

        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Liquidation Amount</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(amount)}
            </p>
          </div>

          {/* Proof section */}
          {hasProof && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                Proof Document
              </span>
              {proofLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Icon
                    icon={icons.loaderCircle}
                    size={16}
                    className="animate-spin"
                  />
                  Loading proof…
                </div>
              ) : signedUrl && isImage ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <img
                    src={signedUrl}
                    alt="Liquidation proof"
                    className="w-full object-contain max-h-[40vh]"
                  />
                </div>
              ) : signedUrl ? (
                <Button
                  variant="outline"
                  onClick={() => window.open(signedUrl, "_blank")}
                  className="w-full"
                >
                  <Icon icon={icons.download} size={16} className="mr-2" />
                  Download Proof
                </Button>
              ) : null}
            </div>
          )}

          {/* Status-specific messages */}
          {status === "REJECTED" && (
            <div className="bg-destructive/10 rounded-lg p-4">
              <p className="text-sm text-destructive">
                This liquidation request has been rejected and cannot be
                processed.
              </p>
            </div>
          )}
          {status === "APPROVED" && (
            <div className="bg-success/10 rounded-lg p-4">
              <p className="text-sm text-success">
                This liquidation request has been approved.
              </p>
            </div>
          )}
          {status === "REVIEWING" && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                This liquidation request is currently under review and is waiting
                for a final decision.
              </p>
            </div>
          )}

          {/* Reject note textarea — only when acting */}
          {canAct && (
            <div className="space-y-2">
              <Label htmlFor="reject-note" className="text-sm font-medium">
                Rejection Note{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="reject-note"
                placeholder="Add a reason for rejection…"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          )}
        </section>

        <DialogFooter>
          {canAct ? (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                loading={rejectLiq.isPending}
                disabled={isPending}
                className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
              >
                Reject
              </Button>
              <Button
                onClick={handleAccept}
                loading={acceptLiq.isPending}
                disabled={isPending}
                className="rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm flex-1 btn-gradient"
              >
                Accept
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpen(false)}
              className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
