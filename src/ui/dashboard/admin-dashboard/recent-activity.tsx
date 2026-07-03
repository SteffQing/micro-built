"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardOperations } from "@/lib/queries/admin/dashboard";
import { cn, formatCurrency } from "@/lib/utils";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const humanize = (value: string) =>
  value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export default function RecentActivity() {
  const { data, isLoading } = useQuery(dashboardOperations);
  const ops = data?.data;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Recently Disbursed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded bg-muted" />
          ) : !ops?.recentLoans.length ? (
            <EmptyState>
              No disbursements yet. Approved loans appear here once disbursed.
            </EmptyState>
          ) : (
            <div className="divide-y divide-border">
              {ops.recentLoans.map((loan) => (
                <div key={loan.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/customers/${loan.customerId}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {loan.customerName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{loan.id}</span>
                      {" · "}
                      {humanize(loan.category)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(loan.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(loan.disbursedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">New Customers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded bg-muted" />
          ) : !ops?.recentCustomers.length ? (
            <EmptyState>
              No customers yet. Onboarded customers appear here.
            </EmptyState>
          ) : (
            <div className="divide-y divide-border">
              {ops.recentCustomers.map((customer) => (
                <div key={customer.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {customer.name}
                    </Link>
                    <p className="text-xs font-mono text-muted-foreground">
                      {customer.id}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={cn(
                        "rounded-[4px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        getUserStatusColor(customer.status)
                      )}
                    >
                      {getUserStatusText(customer.status)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(customer.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
