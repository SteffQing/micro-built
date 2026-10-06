"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { cancelChangeRequest } from "@/lib/mutations/user";
import { userPendingChanges } from "@/lib/queries/user";
import { ChangeDiff } from "./change-diff";

const WAITING: Record<ChangeRequestKind, string> = {
  IDENTITY: "Your identity changes are waiting for approval",
  PAYMENT_METHOD: "Your new bank details are waiting for approval",
  PROFILE: "Your profile changes are waiting for approval",
  PAYROLL: "Your payroll details are waiting for approval",
};

const PROPOSED: Record<ChangeRequestKind, string> = {
  IDENTITY: "MicroBuilt proposed changes to your identity details",
  PAYMENT_METHOD: "MicroBuilt proposed new bank details for you",
  PROFILE: "MicroBuilt proposed changes to your profile",
  PAYROLL: "MicroBuilt proposed your payroll details",
};

/**
 * The signed-in user's pending change of this kind, if any: what will change once an admin
 * approves it, and a way to withdraw it. The details shown elsewhere are still the live ones.
 */
export function PendingChangeNotice({ kind }: { kind: ChangeRequestKind }) {
  const { data } = useQuery(userPendingChanges);
  const cancel = useMutation(cancelChangeRequest);
  const request = data?.data?.find((r) => r.kind === kind && r.status === "PENDING");
  if (!request) return null;

  return (
    <div role="status" className="rounded-lg border border-warning/40 bg-warning/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon icon={icons.calendarClock} size={18} className="mt-0.5 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="font-medium">{request.requestedBy ? PROPOSED[kind] : WAITING[kind]}</p>
            <p className="text-sm text-muted-foreground">
              Sent {format(new Date(request.updatedAt), "d MMM yyyy, h:mm a")}. Your current details stay in use until
              {request.requestedBy ? " a super admin approves it. You'll be told either way." : " an admin approves the change."}
            </p>
          </div>
        </div>
        {/* An admin's proposal is withdrawn or decided by super admins, not the customer. */}
        {!request.requestedBy && (
          <Button variant="outline" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate(request.id)}>
            Withdraw
          </Button>
        )}
      </div>
      <div className="mt-4 border-t border-warning/20 pt-4">
        <ChangeDiff request={request} />
      </div>
    </div>
  );
}
