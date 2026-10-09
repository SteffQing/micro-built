"use client";

import { SUPPORT_RETENTION } from "@/lib/support";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Icon, icons } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supportConversations } from "@/lib/queries/support";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<SupportStatus, string> = {
  AI: "Assistant",
  HANDOFF: "With the team",
  ASSIGNED: "With the team",
  CLOSED: "Closed",
};

/** The caller's past conversations, and a way to start a new one. */
export function ConversationList({
  currentId,
  onOpen,
  onNew,
  starting,
}: {
  currentId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  starting?: boolean;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery(supportConversations(page));
  const pages = data?.meta ? Math.ceil(data.meta.total / data.meta.limit) : 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold">Conversations</h2>
        <Button size="sm" onClick={onNew} disabled={starting}>
          <Icon icon={icons.plus} size={14} /> New conversation
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="grid gap-2 px-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load your conversations.{" "}
            <button type="button" onClick={() => void refetch()} className="font-medium text-brand underline">
              Try again
            </button>
          </div>
        ) : !data?.rows.length ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No conversations yet.</p>
        ) : (
          <ul className="grid gap-1">
            {data.rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  aria-current={row.id === currentId ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    row.id === currentId && "bg-accent"
                  )}
                >
                  <span className={cn("size-2 shrink-0 rounded-full", row.unread ? "bg-brand" : "bg-transparent")}>
                    {row.unread && <span className="sr-only">Unread reply</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(row.lastMessageAt), { addSuffix: true })}
                    </span>
                  </span>
                  <Badge variant={row.status === "CLOSED" ? "outline" : "secondary"} className="shrink-0">
                    {STATUS_LABEL[row.status]}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 px-1 text-center text-xs text-muted-foreground">{SUPPORT_RETENTION}</p>
        {pages > 1 && (
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Newer">
              <Icon icon={icons.chevronLeft} size={14} />
            </Button>
            {page} / {pages}
            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Older">
              <Icon icon={icons.chevronRight} size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
