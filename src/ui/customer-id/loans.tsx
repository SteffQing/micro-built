import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customerLoans } from "@/lib/queries/admin/customer";
import { Separator } from "@/components/ui/separator";
import { ActiveLoansSkeleton, PendingApplicationsSkeleton } from "./skeletons/loans";
import { CashLoanModal } from "../modals";

interface ActiveLoansProps {
  active: ActiveLoanDto[];
}
interface PendingApplicationsProps {
  pending: PendingLoanDto[];
}

const LOANS_PER_PAGE = 2;

function ActiveLoans({ active }: ActiveLoansProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(active.length / LOANS_PER_PAGE);

  console.log(page, totalPages);
  const paginatedLoans = active.slice(page * LOANS_PER_PAGE, page * LOANS_PER_PAGE + LOANS_PER_PAGE);

  return (
    <Card className="w-full bg-background py-0 gap-0">
      <CardHeader className="p-0 py-3 mb-3">
        <div className="flex items-center gap-2 px-5">
          <CardTitle className="text-lg font-semibold">Active Loans</CardTitle>
          <Badge variant="destructive" className="rounded-full w-6 h-6 p-0 flex items-center justify-center text-xs">
            {active.length}
          </Badge>
        </div>
        <Separator className="bg-[#F5F5F5]" />
      </CardHeader>
      <CardContent className="space-y-4 p-0 px-5 mb-3">
        {active.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {paginatedLoans.map((loan, index) => (
              <div key={index} className="space-y-4 p-4 border rounded-lg">
                <div className="flex gap-2 justify-between">
                  <p className="text-[#999999] text-sm font-normal">Loan ID</p>
                  <p className="font-medium text-[#333333] text-sm">{loan.id}</p>
                </div>

                <Separator className="bg-[#F5F5F5]" />

                <div className="flex gap-2 justify-between">
                  <p className="text-[#999999] text-sm font-normal">Total Loan Amount</p>

                  <p className="font-medium text-[#333333] text-sm">{formatCurrency(loan.amount)}</p>
                </div>

                <div className="flex gap-2 justify-between">
                  <p className="text-[#999999] text-sm font-normal">Tenure</p>
                  <p className="font-medium text-[#333333] text-sm">{loan.loanTenure} Months</p>
                </div>

                <div className="flex gap-2 justify-between">
                  <p className="text-[#999999] text-sm font-normal">Repaid Amount</p>
                  <p className="font-medium text-[#333333] text-sm">{formatCurrency(loan.amountRepaid)}</p>
                </div>

                <div className="flex gap-2 justify-between">
                  <div className="flex items-center gap-1">
                    <p className="text-[#999999] text-sm font-normal">Balance</p>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-[#333333] text-sm">{formatCurrency(loan.balance)}</p>
                </div>

                <Separator className="bg-[#F5F5F5]" />

                <div className="w-full flex justify-center">
                  <CashLoanModal
                    trigger={
                      <Button
                        variant="outline"
                        className="text-[#8A0806] p-2 rounded-[5px] border border-[#FFE1E0] w-full bg-transparent hover:bg-transparent"
                      >
                        See Loan Details
                      </Button>
                    }
                    id={loan.id}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center pt-4">
            <div className="flex gap-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === page ? "bg-red-500" : "bg-gray-300"}`}
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

export function PendingApplications({ pending }: PendingApplicationsProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(pending.length / LOANS_PER_PAGE);

  const paginatedLoans = pending.slice(page * LOANS_PER_PAGE, page * LOANS_PER_PAGE + LOANS_PER_PAGE);

  return (
    <Card className="w-full bg-background py-0 gap-0">
      <CardHeader className="p-0 py-3 mb-0">
        <div className="flex items-center gap-2 px-5">
          <CardTitle className="text-base font-medium">Pending Applications</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 mb-3">
        {paginatedLoans.map(({ date, category, amount, id }) => (
          <div key={id} className="flex flex-col gap-3 p-3 border rounded-[6px] border-[#F0F0F0]">
            <div className="flex items-center gap-3 justify-between">
              <div className="flex gap-1">
                <div className="w-6 h-1 bg-[#ECF100] rounded-[2px]" />
                <div className="w-6 h-1 bg-[#CDFFD8] rounded-[2px]" />
                <div className="w-6 h-1 bg-[#FFCBCB] rounded-[2px]" />
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(date, "PPP")}</span>
            </div>
            <h4 className="font-semibold text-[#666666] text-sm mt-5">{category}</h4>
            <div className="flex items-center gap-2 justify-between">
              <p className="text-lg font-semibold text-[#8A0806]">{formatCurrency(amount)}</p>

              <CashLoanModal
                trigger={
                  <div className="flex items-center cursor-pointer gap-1 text-[#999999] text-xs">
                    <span>See loan details</span> <ChevronRight className="w-2 h-4" />{" "}
                  </div>
                }
                id={id}
              />
            </div>
          </div>
        ))}

        {pending.length > LOANS_PER_PAGE ? (
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <p> {page + 1}</p>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600"
              disabled={page === totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        ) : (
          <></>
        )}

        {pending.length === 0 && (
          <div className="flex justify-center items-center h-40 text-muted-foreground text-center">
            User has no pending loan applications
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoansWrapper({ id }: { id: string }) {
  const { data, isLoading } = useQuery(customerLoans(id));

  const activeLoans = data?.data?.activeLoans || [];
  const pendingLoans = data?.data?.pendingLoans || [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">{isLoading ? <ActiveLoansSkeleton /> : <ActiveLoans active={activeLoans} />}</div>
      {isLoading ? <PendingApplicationsSkeleton /> : <PendingApplications pending={pendingLoans} />}
    </div>
  );
}
