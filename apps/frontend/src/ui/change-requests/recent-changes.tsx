"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon, icons } from "@/components/icon";
import { userRecentChanges } from "@/lib/queries/user";
import { cn } from "@/lib/utils";
import { ChangeDiff } from "./change-diff";

const OUTCOME: Partial<Record<ChangeRequestStatus, { label: string; className: string }>> = {
  APPROVED: { label: "Approved", className: "bg-success/10 text-success" },
  REJECTED: { label: "Declined", className: "bg-destructive/10 text-destructive" },
  CANCELLED: { label: "Withdrawn", className: "bg-muted text-muted-foreground" },
};

/** The signed-in user's decided changes of this kind, newest first, with an admin's reason when one was declined. */
export function RecentChanges({ kind }: { kind: ChangeRequestKind }) {
  const { data } = useQuery(userRecentChanges);
  const decided = (data?.data ?? []).filter((r) => r.kind === kind && r.status !== "PENDING").slice(0, 5);
  if (!decided.length) return null;

  return (
    <section aria-label="Recent changes" className="grid gap-2">
      <h3 className="text-sm font-medium">Recent changes</h3>
      <ul className="divide-y rounded-lg border">
        {decided.map((request) => {
          const outcome = OUTCOME[request.status];
          return (
            <li key={request.id}>
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full cursor-pointer items-start justify-between gap-3 p-3 text-left text-sm hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="font-medium">
                      Sent {format(new Date(request.createdAt), "d MMM yyyy")}
                      {request.decidedAt && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · decided {format(new Date(request.decidedAt), "d MMM yyyy")}
                        </span>
                      )}
                    </p>
                    {request.status === "REJECTED" && request.note && (
                      <p className="mt-0.5 text-xs text-destructive wrap-anywhere">Reason: {request.note}</p>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {outcome && (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", outcome.className)}>
                        {outcome.label}
                      </span>
                    )}
                    <Icon
                      icon={icons.chevronDown}
                      size={14}
                      className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                    />
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t bg-muted/20 p-3">
                  <ChangeDiff request={request} />
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
