import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { formatDate } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { allCommodityLoans } from "@/lib/queries/user/loan";
import { PendingApplicationsSkeleton } from "@/ui/customer-id/skeletons/loans";
import { Badge } from "@/components/ui/badge";

const LOANS_PER_PAGE = 2;

type Props = {
  loans: AllUserCommodityLoanDto[];
};

function CommodityLoanApplications({ loans }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(loans.length / LOANS_PER_PAGE);

  const paginatedLoans = loans.slice(page * LOANS_PER_PAGE, page * LOANS_PER_PAGE + LOANS_PER_PAGE);

  return (
    <Card className="w-full bg-background py-0">
      <CardHeader className="p-0 pt-4">
        <div className="flex items-center gap-2 px-5">
          <CardTitle className="text-base font-medium">Asset Loan Applications</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {paginatedLoans.map(({ date, name, id }) => (
          <div key={id} className="flex flex-col gap-7 p-3 border rounded-[6px] border-[#F0F0F0]">
            <div className="flex items-center gap-3 justify-between">
              <div className="flex gap-2 flex-col">
                <div className="flex gap-1">
                  <div className="w-6 h-1 bg-[#13E741] rounded-[2px]" />
                  <div className="w-6 h-1 bg-[#F97316] rounded-[2px]" />
                  <div className="w-6 h-1 bg-[#FFEDE0] rounded-[2px]" />
                </div>
                <p className="text-sm text-[#666666] font-medium">{id}</p>
              </div>
              <Badge className="text-[#F97316] text-sm font-normal bg-[#FFEDE0]">Pending</Badge>
            </div>
            {/* <h4 className="font-semibold text-[#666666] text-sm mt-5">{category}</h4> */}
            <div className="flex items-center gap-2 justify-between">
              <p className="text-lg font-semibold text-[#8A0806]">{name}</p>
              <span className="text-xs text-muted-foreground">{formatDate(date, "PPP")}</span>
            </div>
          </div>
        ))}

        {loans.length > LOANS_PER_PAGE ? (
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
          <></>
        )}

        {loans.length === 0 && (
          <div className="flex justify-center items-center h-40 text-muted-foreground text-center">
            No asset loan applications available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CommodityLoans() {
  const { data, isLoading } = useQuery(allCommodityLoans());
  return isLoading ? <PendingApplicationsSkeleton /> : <CommodityLoanApplications loans={data?.data || []} />;
}
