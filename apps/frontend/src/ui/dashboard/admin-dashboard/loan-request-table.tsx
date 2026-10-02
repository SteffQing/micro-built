"use client";

import * as React from "react";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { capitalize, formatCurrency } from "@/lib/utils";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { openLoanRequests } from "@/lib/queries/admin/dashboard";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { LoanCategory } from "@/config/enums";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RequestRow = {
  id: string;
  customerId: string;
  customerName?: string;
  kind: "LOAN" | "TOPUP" | "COMMODITY";
  display: string; // amount or name
  category: string;
  requestedAt: string | Date;
};

export default function LoanRequestTableAdminDashboard() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const { data, isLoading } = useQuery(openLoanRequests);

  const handleSeeAll = () => {
    router.push("/loans/cash");
  };

  const rows: RequestRow[] = React.useMemo(() => {
    if (!data) return [];
    const cashRows: RequestRow[] = (data.cashLoans ?? []).map((r) => ({
      id: r.id,
      customerId: r.customerId,
      kind: "LOAN" as const,
      display: formatCurrency(r.amount),
      category: r.category,
      requestedAt: r.requestedAt,
    }));
    const topupRows: RequestRow[] = (data.topups ?? []).map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerName: (r as { customerName?: string }).customerName,
      kind: "TOPUP" as const,
      display: formatCurrency(r.amount),
      category: "TOPUP",
      requestedAt: r.requestedAt,
    }));
    const commodityRows: RequestRow[] = (data.commodityLoans ?? []).map((r) => ({
      id: r.id,
      customerId: r.customerId,
      kind: "COMMODITY" as const,
      display: r.name,
      category: r.category,
      requestedAt: r.requestedAt,
    }));
    return [...cashRows, ...topupRows, ...commodityRows];
  }, [data]);

  const filtered = React.useMemo(() => {
    return rows.filter((request) => {
      const matchesCategory = categoryFilter === "all" || request.category === categoryFilter;
      if (!matchesCategory) return false;
      if (!searchTerm) return true;
      const needle = searchTerm.toLowerCase();
      return [request.id, request.customerId, request.category, request.display]
        .filter(Boolean)
        .some((value) => value.toString().toLowerCase().includes(needle));
    });
  }, [rows, searchTerm, categoryFilter]);

  const cashRequests = filtered.filter((r) => r.kind === "LOAN");
  const topupRequests = filtered.filter((r) => r.kind === "TOPUP");
  const commodityRequests = filtered.filter((r) => r.kind === "COMMODITY");

  const renderTable = (items: RequestRow[], title: string, emptyMsg: string) => (
    <div className="overflow-x-auto">
      <Table className="min-w-[820px] text-sm">
        <TableHeader>
          <TableRow className="hover:bg-transparent [&>th]:h-12 [&>th]:px-3 [&>th]:text-[13px] [&>th]:font-medium [&>th]:text-muted-foreground">
            <TableHead className="pl-4 sm:pl-5">Borrower</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Request Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount / Item</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoadingSkeleton columns={6} />
          ) : items.length === 0 ? (
            <TableEmptyState
              colSpan={6}
              title={emptyMsg}
              description={searchTerm || categoryFilter !== "all" ? "No matching requests found." : `No pending ${title.toLowerCase()}`}
            />
          ) : (
            items.map((request) => (
              <TableRow key={request.id} className="hover:bg-muted/50 [&>td]:px-3 [&>td]:py-3.5 [&>td]:text-sm [&>td]:text-muted-foreground">
                <TableCell className="pl-4 sm:pl-5">
                  <div className="flex items-center gap-3">
                    <UserAvatar id={request.customerId} size={32} />
                    <span>{request.customerName || request.customerId}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/loans/${request.kind === "COMMODITY" ? "commodity" : "cash"}/${request.id}`} className="hover:underline">
                    {request.id}
                  </Link>
                </TableCell>
                <TableCell>
                  {request.requestedAt
                    ? new Date(request.requestedAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </TableCell>
                <TableCell>
                  {request.kind === "TOPUP"
                    ? "Top-up"
                    : request.kind === "COMMODITY"
                    ? "Commodity"
                    : capitalize(request.category.replace(/_/g, " "))}
                </TableCell>
                <TableCell className="tabular-nums">{request.display}</TableCell>
                <TableCell className="text-warning!">Pending</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Card className="w-full rounded-xl border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 pb-4 sm:p-6 sm:pb-4">
        <CardTitle className="text-lg font-semibold sm:text-xl">Open Loan Requests</CardTitle>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSeeAll}>
          See all
          <Icon icon={icons.chevronRight} size={16} className="ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex flex-col gap-3 border-y px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <Input
            type="search"
            placeholder="Search loan requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border-border bg-muted sm:max-w-64"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 w-full rounded-lg border-border bg-muted sm:w-52">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="TOPUP">Top-ups</SelectItem>
              {Object.values(LoanCategory).map((category) => (
                <SelectItem key={category} value={category}>
                  {capitalize(category.replace(/_/g, " "))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="cash">
          <div className="border-b px-4 sm:px-5">
            <TabsList className="h-10">
              <TabsTrigger value="cash" className="text-xs">
                Cash Loans ({cashRequests.length})
              </TabsTrigger>
              <TabsTrigger value="topups" className="text-xs">
                Top-ups ({topupRequests.length})
              </TabsTrigger>
              <TabsTrigger value="commodity" className="text-xs">
                Commodity ({commodityRequests.length})
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="cash" className="mt-0">
            {renderTable(cashRequests, "Cash Loans", "No pending cash loan requests")}
          </TabsContent>
          <TabsContent value="topups" className="mt-0">
            {renderTable(topupRequests, "Top-ups", "No pending top-up requests")}
          </TabsContent>
          <TabsContent value="commodity" className="mt-0">
            {renderTable(commodityRequests, "Commodity Loans", "No pending commodity requests")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
