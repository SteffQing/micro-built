"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { requestOrganizationSwitch } from "@/lib/mutations/admin/organizations";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/ui/variations/errors";
import { OrganizationSelect } from "@/ui/variations/organization-select";

export const OUTCOME_LABELS: Record<OrganizationSwitchOutcome, { label: string; tone: string }> = {
  CREATED: { label: "Request sent", tone: "bg-success/10 text-success" },
  NOT_FOUND: { label: "No such customer", tone: "bg-destructive/10 text-destructive" },
  ALREADY_IN_ORGANIZATION: { label: "Already in this organization", tone: "bg-muted text-muted-foreground" },
  PENDING_EXISTS: { label: "A request is already waiting", tone: "bg-warning/10 text-warning" },
};

/**
 * Asks to move one customer to another organization. Nothing moves yet: it becomes an ORGANIZATION change request that
 * a super admin approves on Approvals. Any admin can send it.
 */
export function SwitchOrganizationDialog({
  externalId,
  customerName,
  currentOrganizationId,
  currentOrganization,
  trigger,
}: {
  /** The customer's IPPIS / staff id: the API finds customers by it. */
  externalId: string;
  customerName: string;
  currentOrganizationId?: string;
  currentOrganization?: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [note, setNote] = useState<{ text: string; requestId?: string } | null>(null);
  const [error, setError] = useState("");
  const { mutateAsync, isPending } = useMutation(requestOrganizationSwitch(organizationId));

  function changeOpen(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setOrganizationId("");
      setNote(null);
      setError("");
    }
  }

  async function submit() {
    setError("");
    setNote(null);
    try {
      const response = await mutateAsync([externalId]);
      const result = response.data?.results[0];
      if (!result) {
        setError("The request could not be sent. Please retry.");
        return;
      }
      if (result.outcome === "CREATED") {
        toast.success(response.message);
        changeOpen(false);
        return;
      }
      const text: Record<Exclude<OrganizationSwitchOutcome, "CREATED">, string> = {
        NOT_FOUND: `No customer with the IPPIS ID ${externalId} has payroll on file.`,
        ALREADY_IN_ORGANIZATION: `${customerName} is already in this organization.`,
        PENDING_EXISTS: `A change of organization is already waiting for approval for ${customerName}.`,
      };
      setNote({ text: text[result.outcome], requestId: result.requestId });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto rounded-lg sm:max-w-[460px]">
        <DialogHeader className="border-b">
          <DialogTitle>Switch organization</DialogTitle>
          <DialogDescription>
            For {customerName}
            {currentOrganization ? `, now in ${currentOrganization}` : ""}. A super admin approves it before anything moves.
          </DialogDescription>
        </DialogHeader>
        <form
          className={cn(dialogBodyClass, "pt-4")}
          onSubmit={(e) => {
            e.preventDefault();
            if (organizationId && !isPending) void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="switch-organization" className="text-xs text-muted-foreground">
              Move to
            </Label>
            <OrganizationSelect
              id="switch-organization"
              value={organizationId}
              onChange={(value) => {
                setOrganizationId(value);
                setNote(null);
              }}
              exclude={currentOrganizationId}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Deductions already sent in a variation stay with the old organization. Later months go to the new one, which
            lists the loan as a new deduction.
          </p>

          {note && (
            <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
              {note.text}
              {note.requestId && (
                <>
                  {" "}
                  <Link href={`/approvals?request=${note.requestId}`} className="font-medium text-brand hover:underline">
                    View it
                  </Link>
                </>
              )}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter className="border-t pt-4">
            <Button type="submit" disabled={!organizationId} loading={isPending}>
              Send for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
