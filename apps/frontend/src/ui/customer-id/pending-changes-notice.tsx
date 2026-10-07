"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";
import { adminChangeRequests } from "@/lib/queries/admin/change-requests";
import { KIND_LABELS } from "@/ui/change-requests/change-diff";
import { useUserProvider } from "@/store/auth";

/** The customer's change requests waiting for approval, each linking to it on /approvals. */
export function CustomerPendingChanges({ customerId }: { customerId: string }) {
  // Only admins see approvals (a marketer would get a 403).
  const { userRole } = useUserProvider();
  const { data } = useQuery({
    ...adminChangeRequests({ userId: customerId, status: "PENDING", limit: 5 }),
    enabled: userRole === "ADMIN" || userRole === "SUPER_ADMIN",
    retry: false,
  });
  const pending = data?.data ?? [];
  if (!pending.length) return null;

  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
      <Icon icon={icons.calendarClock} size={18} className="mt-0.5 shrink-0 text-warning" />
      <div className="grid min-w-0 flex-1 gap-1.5 text-sm">
        <p className="font-medium">
          {pending.length === 1 ? "A change is waiting for approval" : `${pending.length} changes are waiting for approval`}
        </p>
        <ul className="grid gap-1">
          {pending.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
              <span className="text-muted-foreground">
                {KIND_LABELS[request.kind]} · sent {format(new Date(request.updatedAt), "d MMM yyyy")}
              </span>
              <Link
                href={`/approvals?request=${request.id}`}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-brand hover:underline"
              >
                Review
                <Icon icon={icons.chevronRight} size={14} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
