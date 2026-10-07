"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Icon, icons, type IconData } from "@/components/icon";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerNameLink } from "@/components/customer-name-link";
import { myStats } from "@/lib/queries/admin/account-officer";
import { marketerOverview } from "@/lib/queries/marketer";
import { useUserProvider } from "@/store/auth";
import { CustomerGroupStatsCards } from "@/ui/account-officers/details/stats-cards";
import { EscalateDialog, escalatedAgo } from "./escalate-dialog";
import { ItemDetailsDialog } from "./item-details-dialog";

const KIND_ICON: Record<WaitingItemDto["kind"], IconData> = {
  CUSTOMER: icons.user,
  LOAN: icons.loans,
  ASSET_REQUEST: icons.creditCard,
  TOPUP: icons.wallet,
  ORGANIZATION: icons.building,
};

function WaitingRow({ item }: { item: WaitingItemDto }) {
  const ago = escalatedAgo(item.lastEscalatedAt);
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon icon={KIND_ICON[item.kind]} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.customer && (
            <>
              <CustomerNameLink id={item.customer.id} name={item.customer.name} />
              {" · "}
            </>
          )}
          {item.detail} · {formatDistanceToNow(new Date(item.since), { addSuffix: true })}
          {ago && ` · asked ${ago}`}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {item.escalation && item.stage && (
          <EscalateDialog
            kind={item.escalation}
            id={item.id}
            stage={item.stage}
            lastEscalatedAt={item.lastEscalatedAt}
            what={item.customer ? `${item.customer.name}'s ${item.title.toLowerCase()}` : item.title.toLowerCase()}
          />
        )}
        {item.escalation && <ItemDetailsDialog kind={item.escalation} id={item.id} />}
      </div>
    </li>
  );
}

/** Everything of the marketer's that an admin still has to act on, oldest first. */
function WaitingCard() {
  const { data, isLoading } = useQuery(marketerOverview);
  const waiting = data?.data?.waiting ?? [];
  return (
    <Card className="gap-0 overflow-hidden bg-background p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-semibold text-foreground">Waiting on an admin</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            New accounts, loans, asset requests, top-ups and organizations you added, oldest first. Escalate anything
            that has waited too long.
          </p>
        </div>
        {!isLoading && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {waiting.length}
          </span>
        )}
      </div>
      <Separator />
      {isLoading ? (
        <div className="grid gap-2 p-4 sm:p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : waiting.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <Icon icon={icons.checkCircle} size={24} className="text-success" />
          <p className="text-sm font-medium">Nothing is waiting on an admin</p>
          <p className="text-xs text-muted-foreground">New customers and loans you add will show here until they&apos;re dealt with.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {waiting.map((item) => (
            <WaitingRow key={`${item.kind}:${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/** A marketer's dashboard: their customers' figures and what waits on an admin. */
export function MarketerDashboardPage() {
  const { user } = useUserProvider();
  const stats = useQuery(myStats);
  const first = user?.name?.split(" ")[0];
  return (
    <main className="@container/main space-y-3 p-3 lg:space-y-5 lg:p-5">
      <PageTitle
        title={first ? `Welcome, ${first}` : "Dashboard"}
        actionContent={
          <Button asChild size="sm" className="h-9">
            <Link href="/customers/add-customer">
              <Icon icon={icons.plus} size={16} />
              Add customer
            </Link>
          </Button>
        }
      />
      <CustomerGroupStatsCards stats={stats.data?.data} loading={stats.isLoading} label="Your customers" />
      <WaitingCard />
    </main>
  );
}
