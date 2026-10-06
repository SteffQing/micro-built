import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { userOverview } from "@/lib/queries/user";
import { DeductionsCard } from "@/ui/repayments/deductions-card";
import ReportCard from "@/components/report-card";
import { icons } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";

export function SectionCardsUserDashboard() {
  const { data, isLoading } = useQuery(userOverview);

  const pendingLoanRequest = data?.data?.pendingLoanRequestsCount || 0;
  const currentLoan = data?.data?.currentLoan;
  const lastDeduction = data?.data?.lastDeduction || null;
  const nextDeduction = data?.data?.nextDeduction || null;
  const repaymentRate = data?.data?.repaymentRate || 0;

  const totalLoan = currentLoan?.owed || 0;
  const repaidAmount = currentLoan?.repaid || 0;
  const outstandingAmount = currentLoan?.outstanding || 0;
  const repaymentProgress = totalLoan > 0 ? (repaidAmount / totalLoan) * 100 : 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 justify-between w-full">
      <Card className="sm:col-span-2 bg-background">
        <CardHeader>
          <CardTitle className="flex items-center  justify-between gap-2">
            <p>Active Loan</p>
            {totalLoan > 0 && repaidAmount > 0 && (
              <Badge variant="secondary" className="rounded-2xl">
                <div className="w-1 h-1 bg-primary rounded-full"></div>
                Active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-semibold">
            ₦{totalLoan.toLocaleString()}
          </p>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={repaymentProgress} className="h-2 bg-success/10" />
            <div className="flex justify-between text-sm">
              <div className="flex gap-1">
                <span className="text-muted-foreground">Repaid:</span>
                <span className="text-primary font-semibold text-sm">
                  {" "}
                  ₦{repaidAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex gap-1">
                <span className="text-muted-foreground">Balance:</span>
                <span className="text-primary font-semibold text-sm">
                  {" "}
                  ₦{outstandingAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <ReportCard
        title="Repayment Rate"
        value={repaymentRate.toString()}
        icon={<IconTile icon={icons.percent} />}
        loading={isLoading}
        className="sm:col-span-1"
      />

      <ReportCard
        title="Pending Requests"
        value={pendingLoanRequest.toString()}
        icon={<IconTile icon={icons.alert} tone="warning" />}
        loading={isLoading}
        className="sm:col-span-1"
      />

      <DeductionsCard
        next={nextDeduction}
        last={lastDeduction}
        loading={isLoading}
        className="sm:col-span-2"
      />
    </div>
  );
}
