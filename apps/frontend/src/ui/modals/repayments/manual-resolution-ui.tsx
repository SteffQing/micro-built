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
import { Icon, icons } from "@/components/icon";
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
      <p className="min-w-0 break-words text-right text-sm font-medium text-foreground">{content}</p>
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
  const hasUser = Boolean(admin.customer);

  const [action, setAction] = useState<"APPLY" | "SETTLE" | "REJECT">("APPLY");
  const [customerId, setCustomerId] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const { data: loansData, isLoading: loansLoading } = useQuery({
    ...customerLoans(admin.customer?.id ?? ""),
    enabled: isOpen && hasUser,
  });
  const activeLoans = loansData?.data?.activeLoans ?? [];

  // The mutation already toasts + invalidates the cache; the per-call onSuccess
  // below runs in addition to that, so we only add the modal-close here.
  const { mutate, isPending } = useMutation(resolveRepayment(admin.id));

  // Missing-user rows need a target customer id; overflow rows need a loan to
  // apply the parked amount to. note is always required.
  const canSubmit =
    note.trim().length > 0 && (hasUser ? Boolean(action !== "REJECT" || true) : Boolean(customerId));

  const handleSubmit = () => {
    if (!canSubmit) return;
    mutate(
      {
        action,
        note: note.trim(),
        ...(!hasUser ? { customerId: customerId.trim() } : {}),
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

      <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="grid gap-3">
          <Row
            title="Amount to Resolve"
            content={formatCurrency(admin.amount)}
          />
          <Row title="Repayment Period" content={admin.period} />
          <Row title="Status" content={admin.state} />
          <Row
            title="Customer"
            content={admin.customer ? admin.customer.name : "Not found (no IPPIS match)"}
          />
        </div>

        <Separator className="bg-border" />

        <div className="grid gap-4">
          {hasUser ? (
            <div className="grid gap-2">
              <Label htmlFor="action">Resolution action</Label>
              <Select value={action} onValueChange={(v) => setAction(v as "APPLY" | "SETTLE" | "REJECT")}>
                <SelectTrigger id="action" className="w-full">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPLY">Apply to loan</SelectItem>
                  <SelectItem value="SETTLE">Settle repayment</SelectItem>
                  <SelectItem value="REJECT">Reject / reverse</SelectItem>
                </SelectContent>
              </Select>
              {action === "APPLY" && (
                <>
                  {loansLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Loading active loans...
                    </p>
                  ) : activeLoans.length ? (
                    <Select defaultValue={activeLoans[0]?.id}>
                      <SelectTrigger className="w-full" aria-label="Select an active loan">
                        <SelectValue placeholder="Select an active loan" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeLoans.map((loan) => (
                          <SelectItem key={loan.id} value={loan.id}>
                            {loan.id} — outstanding {formatCurrency(loan.outstanding)}
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
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="customerId">Customer ID</Label>
              <Input
                id="customerId"
                placeholder="e.g. MB-HOWP2"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
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
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
          {isPending ? <Icon icon={icons.loaderCircle} size={16} className="animate-spin" /> : "Resolve"}
        </Button>
      </DialogFooter>
    </>
  );
}
