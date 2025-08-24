"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { formatDate } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { openLoanRequests } from "@/lib/queries/admin/dashboard";
import Link from "next/link";
import UserAvatarComponent from "@/ui/settings/user-settings-view/user-avatar";

export default function LoanRequestTableAdminDashboard() {
  const router = useRouter();
  const { data, isLoading } = useQuery(openLoanRequests);

  const handleSeeAll = () => {
    router.push("/loans/cash");
  };

  return (
    <Card className="w-full bg-background">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">Recent Loan Requests</CardTitle>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSeeAll}>
          See all
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Borrower</TableHead>
              <TableHead>Loan ID</TableHead>
              <TableHead>Request Date</TableHead>
              <TableHead>Loan Type</TableHead>
              <TableHead>Loan Amount/Item</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingSkeleton columns={5} />
            ) : !isLoading && data && data.length === 0 ? (
              <TableEmptyState
                colSpan={5}
                title="No recent open loan requests"
                description="No PENDING cash/commodity loan requests"
              />
            ) : (
              data!.map(({ customerId, ...request }) => (
                <TableRow key={request.id} className="hover:bg-muted/50">
                  <TableCell>
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
                    {formatCurrency((request as CashLoanRequestDto).amount) ||
                      (request as CommodityLoanRequestDto).name}
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
