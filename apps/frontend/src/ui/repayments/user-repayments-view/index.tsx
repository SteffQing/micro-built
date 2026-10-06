import { SectionCardsUserRepayment } from "./section-card";
import RepaymentsHistoryTable from "./table";
import { UserDeductionsTab, UserInflowsTab } from "./tabs";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Icon, icons } from "@/components/icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CustomerLiquidationSheet } from "@/ui/liquidation";
import { CustomerLiquidationHistory } from "@/ui/liquidation";
import { userLoanOverview } from "@/lib/queries/user/loan";
import { useQuery } from "@tanstack/react-query";

export function UserRepaymentsPage() {
  const { data: loanOverview, isLoading } = useQuery(userLoanOverview);
  const hasActiveLoan = (loanOverview?.data?.disbursedCount ?? 0) > 0;
  const liquidate = (
    <Button className="h-9 gap-1.5" disabled={!hasActiveLoan}>
      <Icon icon={icons.moneyReceive} size={16} />
      Request Liquidation
    </Button>
  );

  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <PageTitle
        title="Repayments"
        actionContent={
          hasActiveLoan ? (
            <CustomerLiquidationSheet trigger={liquidate} />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* A disabled button swallows pointer events; the span keeps its tooltip reachable. */}
                <span tabIndex={0}>{liquidate}</span>
              </TooltipTrigger>
              <TooltipContent>
                {isLoading ? "Checking your loan…" : "You can pay off a loan once it is running"}
              </TooltipContent>
            </Tooltip>
          )
        }
      />
      <SectionCardsUserRepayment />
      <Tabs defaultValue="deductions">
        <TabsList>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="inflows">Payments received</TabsTrigger>
          <TabsTrigger value="repayments">Repayments</TabsTrigger>
        </TabsList>
        <TabsContent value="deductions" className="mt-4">
          <UserDeductionsTab />
        </TabsContent>
        <TabsContent value="inflows" className="mt-4">
          <UserInflowsTab />
        </TabsContent>
        <TabsContent value="repayments" className="mt-4">
          <RepaymentsHistoryTable />
        </TabsContent>
      </Tabs>
      <CustomerLiquidationHistory />
    </div>
  );
}
