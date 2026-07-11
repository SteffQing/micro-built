"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
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
import { formatDate } from "date-fns";
import { capitalize, formatCurrency } from "@/lib/utils";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { openLoanRequests } from "@/lib/queries/admin/dashboard";
import Link from "next/link";
import UserAvatarComponent from "@/ui/settings/user-settings-view/user-avatar";
import { LoanCategory } from "@/config/enums";

export default function LoanRequestTableAdminDashboard() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const { data, isLoading } = useQuery(openLoanRequests);

  const handleSeeAll = () => {
    router.push("/loans/cash");
  };

  const requests = React.useMemo(() => {
    const rows = data ?? [];

    return rows.filter((request) => {
      const matchesCategory = categoryFilter === "all" || request.category === categoryFilter;

      if (!matchesCategory) return false;
      if (!searchTerm) return true;

      const needle = searchTerm.toLowerCase();
      const amount = "amount" in request ? formatCurrency(request.amount) : "";
      const assetName = "name" in request ? request.name : "";

      return [request.id, request.customerId, request.category, amount, assetName]
        .filter(Boolean)
        .some((value) => value.toString().toLowerCase().includes(needle));
    });
  }, [data, searchTerm, categoryFilter]);

  return (
    <Card className="w-full rounded-xl border-[#eeeeee] bg-white shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">Recent Loan Requests</CardTitle>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSeeAll}>
          See all
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex flex-col gap-3 border-y px-5 py-3 sm:flex-row sm:items-center">
          <Input
            type="search"
            placeholder="Search loan requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border-[#e8e8e8] bg-[#fafafa] sm:max-w-64"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 w-full rounded-lg border-[#e8e8e8] bg-[#fafafa] sm:w-52">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.values(LoanCategory).map((category) => (
                <SelectItem key={category} value={category}>
                  {capitalize(category.replace(/_/g, " "))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Name</TableHead>
              <TableHead>Loan ID</TableHead>
              <TableHead>Request Date</TableHead>
              <TableHead>Loan Type</TableHead>
              <TableHead>Loan Amount/Item</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingSkeleton columns={6} />
            ) : !isLoading && requests.length === 0 ? (
              <TableEmptyState
                colSpan={6}
                title="No recent open loan requests"
                description={searchTerm || categoryFilter !== "all" ? "No matching open loan requests found." : "No PENDING cash/commodity loan requests"}
              />
            ) : (
              requests.map(({ customerId, ...request }) => (
                <TableRow key={request.id} className="hover:bg-muted/50">
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <UserAvatarComponent id={customerId} className="w-8 h-8" />
                      <h4 className="flex flex-col font-medium">{customerId}</h4>
                    </div>
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">
                    <Link href={`/${"name" in request ? "commodityloan" : "cashloan"}/${request.id}`}>
                      {request.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(request.requestedAt, "PP")}</TableCell>
                  <TableCell>{request.category}</TableCell>
                  <TableCell className="font-medium">
                    {"amount" in request ? formatCurrency(request.amount) : request.name}
                  </TableCell>
                  <TableCell className="font-medium text-[#e5b900]">Pending</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
