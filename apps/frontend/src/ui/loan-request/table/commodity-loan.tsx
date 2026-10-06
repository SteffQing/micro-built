import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon, icons } from "@/components/icon";
import { formatDate } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { allCommodityLoans } from "@/lib/queries/user/loan";
import { PendingApplicationsSkeleton } from "@/ui/customer-id/skeletons/loans";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";

const LOANS_PER_PAGE = 2;

// Three bars: requested, approved, delivered.
const STAGE: Record<UserCommodityLoan["stage"], { label: string; badge: string; bars: [string, string, string] }> = {
  IN_REVIEW: {
    label: "In review",
    badge: "text-warning bg-warning/10",
    bars: ["bg-success", "bg-warning", "bg-muted"],
  },
  APPROVED: {
    label: "Approved",
    badge: "text-success bg-success/10",
    bars: ["bg-success", "bg-success", "bg-warning"],
  },
  DELIVERED: {
    label: "Delivered",
    badge: "text-primary bg-primary/10",
    bars: ["bg-success", "bg-success", "bg-success"],
  },
  REJECTED: {
    label: "Rejected",
    badge: "text-destructive bg-destructive/10",
    bars: ["bg-success", "bg-destructive", "bg-muted"],
  },
};

type Props = {
  loans: UserCommodityLoan[];
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
        {paginatedLoans.map(({ date, name, id, stage, kind, amount }) => {
          const look = STAGE[stage] ?? STAGE.IN_REVIEW;
          return (
            <div key={id} className="flex flex-col gap-7 p-3 border rounded-[6px] border-border">
              <div className="flex items-center gap-3 justify-between">
                <div className="flex min-w-0 gap-2 flex-col">
                  <div className="flex gap-1">
                    {look.bars.map((bar, i) => (
                      <div key={i} className={cn("w-6 h-1 rounded-[2px]", bar)} />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">
                    {kind === "TOPUP" ? "Asset top-up" : "Asset loan"}
                    {amount !== null && ` · ${formatCurrency(amount)}`}
                  </p>
                </div>
                <Badge className={cn("text-sm font-normal", look.badge)}>{look.label}</Badge>
              </div>
              <div className="flex items-center gap-2 justify-between">
                <p className="text-lg font-semibold text-brand min-w-0 truncate">{name}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(date, "PPP")}</span>
              </div>
            </div>
          );
        })}

        {loans.length > LOANS_PER_PAGE ? (
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <Icon icon={icons.chevronLeft} size={16} className="mr-1" />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next
              <div className="ml-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                {page + 1}
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
