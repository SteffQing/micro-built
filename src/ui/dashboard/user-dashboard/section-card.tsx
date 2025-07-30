import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconsIllustration } from "@/components/icons-illustrations";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { userOverview } from "@/lib/queries/user";
import { formatDate } from "date-fns";
import ReportCard from "@/components/report-card";

export function SectionCardsUserDashboard() {
  const { data, isLoading } = useQuery(userOverview);

  const pendingLoanRequest = data?.data?.pendingLoanRequestsCount || 0;
  const nextRepaymentDate = data?.data?.nextRepaymentDate || null;
  const lastDeduction = data?.data?.lastDeduction || null;
  const overdueLoansCount = data?.data?.overdueLoansCount || 0;

  const totalLoan = data?.data?.activeLoanAmount || 0;
  const repaidAmount = data?.data?.activeLoanRepaid || 0;
  const repaymentProgress = (repaidAmount / totalLoan) * 100;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 justify-between w-full">
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
          <p className="text-2xl font-semibold">₦{totalLoan.toLocaleString()}</p>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={repaymentProgress} className="h-2 bg-green-100" />
            <div className="flex justify-between text-sm">
              <div className="flex gap-1">
                <span className="text-muted-foreground">Repaid:</span>
                <span className="text-primary font-semibold text-sm"> ₦{repaidAmount.toLocaleString()}</span>
              </div>
              <div className="flex gap-1">
                <span className="text-muted-foreground">Balance:</span>
                <span className="text-primary font-semibold text-sm"> ₦{totalLoan - repaidAmount}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <ReportCard
        title="Overdue Loans"
        value={overdueLoansCount.toString()}
        icon={<IconsIllustration.bad_contract className="h-10" />}
        loading={isLoading}
        className="sm:col-span-1"
      />

      <ReportCard
        title="Pending Requests"
        value={pendingLoanRequest.toString()}
        icon={<IconsIllustration.percentage className="h-10" />}
        loading={isLoading}
        className="sm:col-span-1"
      />

      <div className="bg-white border sm:col-span-2 lg:col-span-1 border-[#F0F0F0] rounded-[12px] p-4 lg:p-5 flex flex-col gap-2 w-full relative justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-[#999999] text-xs font-normal">Next Repayment</p>
          <p className="text-[#666666] font-medium text-base">
            {nextRepaymentDate ? formatDate(nextRepaymentDate, "PPP") : "No upcoming payment"}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[#999999] text-xs font-normal">Last Deduction</p>
          <div className="flex items-baseline gap-2">
            <p className="text-[#666666] font-medium text-base">
              {lastDeduction ? lastDeduction.amount : "No previous deductions"}
            </p>
            {lastDeduction && (
              <span className="text-sm text-muted-foreground">on {formatDate(lastDeduction.date, "PPP")}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
