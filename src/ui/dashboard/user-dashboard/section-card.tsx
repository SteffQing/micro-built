import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconsIllustration } from "@/components/icons-illustrations";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { userOverviewQuery } from "@/lib/queries/user-overview";

export function SectionCardsUserDashboard() {
  const { data } = useQuery({ ...userOverviewQuery });

  const pendingLoanRequest = data?.pendingLoanRequestsCount || 0;
  const nextRepaymentDate = data?.nextRepaymentDate || null;
  const lastDeduction = data?.lastDeduction || null;
  const overdueLoansCount = data?.overdueLoansCount || 0;

  const totalLoan = data?.activeLoanAmount || 0;
  const repaidAmount = data?.activeLoanRepaid || 0;
  const repaymentProgress = (repaidAmount / totalLoan) * 100;
  return (
    <div className="lg:grid lg:grid-cols-5 flex flex-col gap-2 justify-between w-full ">
      <Card className="col-span-2 bg-background">
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
            <Progress value={repaymentProgress} className="h-2 bg-green-100" />
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
                  ₦{totalLoan - repaidAmount}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.bad_contract className="h-10" />
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Overdue loans</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {overdueLoansCount}
          </div>
        </CardFooter>
      </Card>
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.percentage className="h-10" />
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Pending Requests</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {pendingLoanRequest}
          </div>
        </CardFooter>
      </Card>
      <Card className="bg-background border border-border">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">
                Next Repayment:
              </span>
              <div className="font-semibold text-xl text-foreground">
                {nextRepaymentDate ?? "--"}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">
                Last Deduction
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-xl text-foreground">
                  {lastDeduction ?? "--"}
                </span>
                <span className="text-sm text-muted-foreground">
                  on {lastDeduction ?? "--"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
