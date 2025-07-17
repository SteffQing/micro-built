import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customerLoans } from "@/lib/queries/admin/customer";
import { Separator } from "@/components/ui/separator";

interface ActiveLoansProps {
  active?: ActiveLoanDto[];
}
interface PendingApplicationsProps {
  pending?: PendingLoanDto[];
}

const LOANS_PER_PAGE = 2;

function ActiveLoans({ active = [] }: ActiveLoansProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(active.length / LOANS_PER_PAGE);

  const paginatedLoans = active.slice(
    page * LOANS_PER_PAGE,
    page * LOANS_PER_PAGE + LOANS_PER_PAGE
  );

  return (
    <Card className="w-full p-0 gap-0">
      <CardHeader className="p-0 py-3 mb-3">
        <div className="flex items-center gap-2 px-5">
          <CardTitle className="text-lg font-semibold">Active Loans</CardTitle>
          <Badge
            variant="destructive"
            className="rounded-full w-6 h-6 p-0 flex items-center justify-center text-xs"
          >
            {active.length}
          </Badge>
        </div>
        <Separator className="bg-[#F5F5F5]" />
      </CardHeader>
      <CardContent className="space-y-4 p-0 px-5">
        <div className="grid gap-3 md:grid-cols-2">
          {paginatedLoans.map((loan, index) => (
            <div key={index} className="space-y-4 p-4 border rounded-lg">
              <div className="flex gap-2 justify-between">
                <p className="text-[#999999] text-sm font-normal">Loan ID</p>
                <p className="font-medium text-[#333333] text-sm">{loan.id}</p>
              </div>

              <Separator className="bg-[#F5F5F5]" />

              <div className="flex gap-2 justify-between">
                <p className="text-[#999999] text-sm font-normal">
                  Total Loan Amount
                </p>

                <p className="font-medium text-[#333333] text-sm">
                  {formatCurrency(loan.amount)}
                </p>
              </div>

              <div className="flex gap-2 justify-between">
                <p className="text-[#999999] text-sm font-normal">Tenure</p>
                <p className="font-medium text-[#333333] text-sm">
                  {loan.loanTenure} Months
                </p>
              </div>

              <div className="flex gap-2 justify-between">
                <p className="text-[#999999] text-sm font-normal">
                  Repaid Amount
                </p>
                <p className="font-medium text-[#333333] text-sm">
                  {formatCurrency(loan.amountRepaid)}
                </p>
              </div>

              <div className="flex gap-2 justify-between">
                <div className="flex items-center gap-1">
                  <p className="text-[#999999] text-sm font-normal">Balance</p>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="font-medium text-[#333333] text-sm">
                  {formatCurrency(loan.balance)}
                </p>
              </div>

              <Separator className="bg-[#F5F5F5]" />

              <div className="w-full">
                <Button
                  variant="outline"
                  className="text-[#8A0806] p-2 rounded-[5px] border border-[#FFE1E0] w-full bg-transparent hover:bg-transparent"
                >
                  See Loan Details
                </Button>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center pt-4">
            <div className="flex gap-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === page ? "bg-red-500" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {active.length === 0 && (
          <div className="flex justify-center items-center h-40 text-muted-foreground text-center">
            User has no active loan running
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PendingApplications({
  pending = [],
}: PendingApplicationsProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(pending.length / LOANS_PER_PAGE);

  const paginatedLoans = pending.slice(
    page * LOANS_PER_PAGE,
    page * LOANS_PER_PAGE + LOANS_PER_PAGE
  );

  return (
    <Card className="w-full">
      <CardHeader className="">
        <CardTitle className="text-lg font-semibold">
          Pending Applications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {paginatedLoans.map((application, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <div className="w-8 h-1 bg-yellow-400 rounded"></div>
                <div className="w-6 h-1 bg-red-400 rounded"></div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(application.date, "PPP")}
                  </span>
                </div>
                <h4 className="font-medium">{application.category}</h4>
                <p className="text-lg font-semibold text-red-600">
                  {application.amount}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              See loan details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        ))}

        {pending.length > 0 ? (
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <div className="ml-1 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
                {page}
              </div>
            </Button>
          </div>
        ) : (
          <div className="flex justify-center items-center h-40 text-muted-foreground text-center">
            User has no pending loan applications
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoansWrapper({ id }: { id: string }) {
  const { data: loanSummary } = useQuery(customerLoans(id));

  const activeLoans = loanSummary?.data?.activeLoans || [];
  const pendingLoans = loanSummary?.data?.pendingLoans || [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ActiveLoans active={activeLoans} />
      </div>
      <PendingApplications pending={pendingLoans} />
    </div>
  );
}
