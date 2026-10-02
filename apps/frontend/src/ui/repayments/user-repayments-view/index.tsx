import { SectionCardsUserRepayment } from "./section-card";
import RepaymentsHistoryTable from "./table";
// import { RepaymentChart } from "../deprecated/repayment-chart";
// import { MonthlyDeductionsTable } from "../deprecated/monthly-repayments";
import PageTitle from "@/components/page-title";
import RequestLoanModal from "@/ui/modals/request-loan";
import { CustomerLiquidationSheet } from "@/ui/liquidation";
import { CustomerLiquidationHistory } from "@/ui/liquidation";
import { userLoanOverview } from "@/lib/queries/user/loan";
import { useQuery } from "@tanstack/react-query";

export function UserRepaymentsPage() {
  const { data: loanOverview } = useQuery(userLoanOverview);
  const hasActiveLoan = (loanOverview?.data?.disbursedCount ?? 0) > 0;

  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <PageTitle
        title="Repayments"
        actionContent={
          <div className="flex items-center gap-2">
            {hasActiveLoan && <CustomerLiquidationSheet />}
            <RequestLoanModal />
          </div>
        }
      />
      <SectionCardsUserRepayment />
      {/* <div className="lg:grid grid-cols-5 gap-4">
        <MonthlyDeductionsTable />
        <RepaymentChart />
      </div> */}
      <RepaymentsHistoryTable />
      <CustomerLiquidationHistory />
    </div>
  );
}
