"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { userRepaymentsHistoryQueryOptions } from "@/lib/queries/repayments-history";
import { formatCurrency } from "@/lib/utils";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
// import { RepaymentStatusEnum } from "@/config/enums";

const statusOptions: {
  value: RepaymentStatus;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}[] = [
  { value: RepaymentStatus.AWAITING, label: "Awaiting", variant: "outline" },
  { value: RepaymentStatus.PARTIAL, label: "Partial", variant: "secondary" },
  { value: RepaymentStatus.FULFILLED, label: "Fulfilled", variant: "default" },
  { value: RepaymentStatus.OVERPAID, label: "Overpaid", variant: "secondary" },
  { value: RepaymentStatus.FAILED, label: "Failed", variant: "destructive" },
  {
    value: RepaymentStatus.MANUAL_RESOLUTION,
    label: "Manual Resolution",
    variant: "outline",
  },
];
export function MonthlyDeductionsTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RepaymentStatus | undefined>();
  const [selectedYear, setSelectedYear] = useState("2025");
  const limit = 10;

  const { data, isLoading } = useQuery({
    ...userRepaymentsHistoryQueryOptions({
      page: currentPage,
      limit,
    }),
  });

  const totalPages = data ? Math.ceil(data.meta.total / data.meta.limit) : 0;

  return (
    <Card className="w-full col-span-2 bg-background">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-medium">Monthly Deductions</CardTitle>
        <div className="flex items-center gap-4">
          <Select
            value={statusFilter || "ALL"}
            onValueChange={(value) => {
              setStatusFilter(value === "ALL" ? undefined : (value as RepaymentStatus));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingSkeleton />
              ) : data && data.data.length > 0 ? (
                data?.data.map((repayment) => (
                  <TableRow key={repayment.id}>
                    <TableCell className="font-medium text-muted-foreground">{repayment.period}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(repayment.repaid)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(300000)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmptyState colSpan={3} />
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.meta.total > 0 && (
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 text-red-600 hover:text-red-700"
            >
              Next
              <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white text-xs">
                {currentPage}
              </div>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
