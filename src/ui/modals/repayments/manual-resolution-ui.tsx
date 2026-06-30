"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { customerLoans } from "@/lib/queries/admin/customer";
import { resolveRepayment } from "@/lib/mutations/admin/repayments";
import { formatCurrency } from "@/lib/utils";

interface DetailsProps {
  repayment: SingleRepaymentWithUserDto | SingleUserRepaymentDto;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function Row({ title, content }: { title: string; content: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm font-normal text-muted-foreground">{title}</p>
      <p className="text-right text-sm font-medium text-foreground">{content}</p>
    </div>
  );
}

export function ManualResolution({
  repayment,
  isOpen,
  onOpenChange,
}: DetailsProps) {
  // This modal only handles the admin MANUAL_RESOLUTION case; user-side
  // repayments never reach this branch.
  const admin = repayment as SingleRepaymentWithUserDto;
  const hasUser = Boolean(admin.user);

  const [loanId, setLoanId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [resolutionNote, setResolutionNote] = useState<string>("");

  const { data: loansData, isLoading: loansLoading } = useQuery({
    ...customerLoans(admin.user?.id ?? ""),
    enabled: isOpen && hasUser,
  });
  const activeLoans = loansData?.data?.activeLoans ?? [];

  // The mutation already toasts + invalidates the cache; the per-call onSuccess
  // below runs in addition to that, so we only add the modal-close here.
  const { mutate, isPending } = useMutation(resolveRepayment(admin.id));

  // Missing-user rows need a target customer id; overflow rows need a loan to
  // apply the parked amount to. resolutionNote is always required.
  const canSubmit =
    resolutionNote.trim().length > 0 && (hasUser ? Boolean(loanId) : Boolean(userId));

  const handleSubmit = () => {
    if (!canSubmit) return;
    mutate(
      {
        resolutionNote: resolutionNote.trim(),
        ...(hasUser ? { loanId } : { userId: userId.trim() }),
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Resolve Repayment</DialogTitle>
      </DialogHeader>

      <Separator className="bg-border" />

      <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-1 py-1">
        <div className="grid gap-3">
          <Row
            title="Amount to Resolve"
            content={formatCurrency(admin.amount)}
          />
          <Row title="Repayment Period" content={admin.period} />
          <Row title="Status" content={admin.status} />
          <Row
            title="Customer"
            content={admin.user ? admin.user.name : "Not found (no IPPIS match)"}
          />
          {admin.failureNote ? (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Why it needs resolution
              </p>
              <p className="text-sm text-foreground">{admin.failureNote}</p>
            </div>
          ) : null}
        </div>

        <Separator className="bg-border" />

        <div className="grid gap-4">
          {hasUser ? (
            <div className="grid gap-2">
              <Label htmlFor="loan">Apply to loan</Label>
              {loansLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading active loans...
                </p>
              ) : activeLoans.length ? (
                <Select value={loanId} onValueChange={setLoanId}>
                  <SelectTrigger id="loan" className="w-full">
                    <SelectValue placeholder="Select an active loan" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeLoans.map((loan) => (
                      <SelectItem key={loan.id} value={loan.id}>
                        {loan.id} — owed {formatCurrency(loan.amountOwed)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-destructive">
                  This customer has no active (disbursed) loans to apply this
                  payment to.
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="userId">Customer ID</Label>
              <Input
                id="userId"
                placeholder="e.g. MB-HOWP2"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                No IPPIS match was found for this payment. Enter the customer ID
                this amount belongs to.
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="note">Resolution note</Label>
            <Textarea
              id="note"
              placeholder="Reason / reference for this manual resolution"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1 rounded-[8px] bg-muted p-2.5 text-sm font-medium text-muted-foreground"
        >
          Close
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
          className="flex-1 rounded-[8px] p-2.5 text-sm font-medium"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resolve"}
        </Button>
      </DialogFooter>
    </>
  );
}
