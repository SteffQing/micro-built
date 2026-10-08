"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, icons } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/use-debounce";
import { adminSupportBase, staffSupportConversations } from "@/lib/queries/support";
import { onSupportEvent } from "@/lib/support-events";
import { cn } from "@/lib/utils";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { SupportAnalyticsView } from "./analytics";

type Tab = "waiting" | "mine" | "all" | "closed" | "analytics";

const TABS: { value: Exclude<Tab, "analytics">; label: string; query: StaffSupportQuery; empty: string }[] = [
  { value: "waiting", label: "Waiting", query: { status: "HANDOFF" }, empty: "Nobody is waiting for the team." },
  { value: "mine", label: "Mine", query: { assignee: "me" }, empty: "No conversations are assigned to you." },
  { value: "all", label: "All", query: {}, empty: "No conversation has been passed to the team yet." },
  { value: "closed", label: "Closed", query: { status: "CLOSED" }, empty: "No closed conversations." },
];

export const STAFF_STATUS: Record<SupportStatus, { label: string; tone: string }> = {
  AI: { label: "Assistant", tone: "bg-muted text-foreground" },
  HANDOFF: { label: "Waiting", tone: "bg-brand/10 text-brand" },
  ASSIGNED: { label: "Assigned", tone: "bg-secondary text-secondary-foreground" },
  CLOSED: { label: "Closed", tone: "bg-muted text-muted-foreground" },
};

const ROLE_NAMES: Record<string, string> = {
  CUSTOMER: "Customer",
  MARKETER: "Marketer",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

export function requesterLabel(requester: StaffSupportRequester) {
  if (requester.role) return { primary: requester.name ?? "", secondary: ROLE_NAMES[requester.role] ?? requester.role };
  // A visitor: the name they left, if any.
  return { primary: requester.name ?? requester.contact ?? "Visitor", secondary: "Visitor" };
}

/** The support inbox: what customers, marketers and visitors passed to the team; analytics for super admins. */
export function SupportInbox({ superAdmin }: { superAdmin: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && (requested !== "analytics" || superAdmin) ? requested : "waiting";

  // A conversation changed somewhere (a handoff, a claim, a reply): the lists and the badge read it again.
  const queryClient = useQueryClient();
  useEffect(
    () => onSupportEvent(() => void queryClient.invalidateQueries({ queryKey: [adminSupportBase, "conversations"] })),
    [queryClient]
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => router.replace(`${pathname}?tab=${value}`, { scroll: false })}
      className="gap-3"
    >
      <TabsList className="max-w-full overflow-x-auto">
        {TABS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
        {superAdmin && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
      </TabsList>
      {TABS.map((config) => (
        <TabsContent key={config.value} value={config.value}>
          {tab === config.value && <InboxTable query={config.query} empty={config.empty} />}
        </TabsContent>
      ))}
      {superAdmin && <TabsContent value="analytics">{tab === "analytics" && <SupportAnalyticsView />}</TabsContent>}
    </Tabs>
  );
}

function InboxTable({ query, empty }: { query: StaffSupportQuery; empty: string }) {
  const [search, setSearch] = useState("");
  const q = useDebounce(search.trim(), 300);
  const [page, setPage] = useState({ q: "", page: 1 });
  const current = page.q === q ? page.page : 1;
  const { data, isLoading, isFetching } = useQuery(staffSupportConversations({ ...query, ...(q && { q }), page: current }));
  const rows = data?.rows ?? [];
  const pages = data?.meta ? Math.max(1, Math.ceil(data.meta.total / data.meta.limit)) : 1;

  return (
    <Card className="gap-0 overflow-hidden p-0 shadow-none">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative w-full sm:max-w-xs">
          <Icon icon={icons.search} size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, name or contact"
            aria-label="Search conversations"
            className="pl-9"
          />
        </div>
        {data?.meta && (
          <span className="ml-auto text-sm text-muted-foreground">
            {data.meta.total} conversation{data.meta.total === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className={cn("overflow-x-auto", isFetching && !isLoading && "opacity-70")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conversation</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Waiting since</TableHead>
              <TableHead>Assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingSkeleton rows={6} columns={5} />
            ) : rows.length === 0 ? (
              <TableEmptyState title={q ? "No matches" : "All clear"} description={q ? "Try another search." : empty} colSpan={5} />
            ) : (
              rows.map((row) => {
                const who = requesterLabel(row.requester);
                return (
                  <TableRow key={row.id} className="relative">
                    <TableCell className="max-w-[18rem]">
                      <Link
                        href={`/support-inbox/${row.id}`}
                        className="flex items-center gap-2 font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:underline"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", row.unread ? "bg-brand" : "bg-transparent")}>
                          {row.unread && <span className="sr-only">Unread</span>}
                        </span>
                        <span className="truncate">{row.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="block truncate">{who.primary}</span>
                      <span className="block text-xs text-muted-foreground">{who.secondary}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("border-transparent", STAFF_STATUS[row.status].tone)}>
                        {STAFF_STATUS[row.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {row.handedOffAt ? formatDistanceToNow(new Date(row.handedOffAt), { addSuffix: true }) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row.assignee?.name ?? <span className="text-muted-foreground">Nobody</span>}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t p-3 text-sm text-muted-foreground">
          <Button size="sm" variant="outline" disabled={current <= 1} onClick={() => setPage({ q, page: current - 1 })}>
            Previous
          </Button>
          Page {current} of {pages}
          <Button size="sm" variant="outline" disabled={current >= pages} onClick={() => setPage({ q, page: current + 1 })}>
            Next
          </Button>
        </div>
      )}
    </Card>
  );
}
