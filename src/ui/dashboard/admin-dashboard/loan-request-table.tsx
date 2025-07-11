"use client";

import { useMemo, useState } from "react";
import { Search, Filter, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { adminOpenLoanRequestsQueryOption } from "@/lib/queries/admin-open-loan-requests";
import { useRouter } from "next/navigation";
import { formatDate } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";


const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "approved":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "rejected":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    case "pending":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
};

const getCategoryDisplayName = (category: string) => {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

interface ProcessedLoanRequest {
  id: string;
  customerId: string;
  name?: string;
  requestDate: string;
  loanType: "Cash Loan" | "Commodity Loan";
  amount?: number;
  commodityName?: string;
  category: string;
  status: "Open";
}
export default function LoanRequestTableAdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const { push } = useRouter();
  const { data, isLoading } = useQuery({
    ...adminOpenLoanRequestsQueryOption,
  });

  const processedLoanRequests = useMemo((): ProcessedLoanRequest[] => {
    if (!data?.data) return [];

    const cashLoans: ProcessedLoanRequest[] = data.data.cashLoans.map(
      (loan) => ({
        id: loan.id,
        customerId: loan.customerId,
        requestDate: loan.requestedAt,
        loanType: "Cash Loan" as const,
        amount: loan.amount,
        category: loan.category,
        status: "Open" as const,
      })
    );

    const commodityLoans: ProcessedLoanRequest[] = data.data.commodityLoans.map(
      (loan) => ({
        id: loan.id,
        customerId: loan.customerId,
        requestDate: loan.requestedAt,
        loanType: "Commodity Loan" as const,
        commodityName: loan.name,
        category: loan.category,
        status: "Open" as const,
      })
    );

    return [...cashLoans, ...commodityLoans].sort(
      (a, b) =>
        new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
    );
  }, [data]);

  const filteredRequests = useMemo(() => {
    if (!searchTerm) return processedLoanRequests;

    return processedLoanRequests.filter(
      (request) =>
        request.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.customerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.loanType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.commodityName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [processedLoanRequests, searchTerm]);

  const displayedRequests = filteredRequests.slice(0, 4);

  const handleSeeAll = () => {
    push("/loan-management");
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">
          Recent Loan Requests
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={handleSeeAll}
        >
          See all
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by ID, customer, type, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Loan ID</TableHead>
              <TableHead>Request Date</TableHead>
              <TableHead>Loan Type</TableHead>
              <TableHead>Loan Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                <TableLoadingSkeleton columns={6} />
              </>
            ) : !isLoading && displayedRequests.length > 0 ? (
              <>
                <TableEmptyState colSpan={6} />
              </>
            ) : (
              displayedRequests.map((request) => (
                <TableRow
                  key={request.id}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src="/placeholder.svg?height=32&width=32"
                          alt={request.customerId}
                        />
                        <AvatarFallback>
                          {request.customerId
                            .split("-")
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {request.name || "Customer"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {request.customerId}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">
                    {request.id}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(request.requestDate, "PPpp")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {request.loanType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {request.loanType === "Cash Loan" && request.amount
                      ? formatCurrency(request.amount)
                      : request.commodityName || "N/A"}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {getCategoryDisplayName(request.category)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={getStatusColor(request.status)}
                    >
                      {request.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
