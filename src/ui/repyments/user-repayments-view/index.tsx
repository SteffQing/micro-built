import { SectionCardsUserRepayment } from "./section-card";
import RepaymentsHistoryTable from "./table";
// import { RepaymentChart } from "../deprecated/repayment-chart";
// import { MonthlyDeductionsTable } from "../deprecated/monthly-repayments";
import PageTitle from "@/components/page-title";
import RequestLoanModal from "@/ui/modals/request-loan";

export function UserRepaymentsPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <PageTitle title="Repayments" actionContent={<RequestLoanModal />} />
      <SectionCardsUserRepayment />
      {/* <div className="lg:grid grid-cols-5 gap-4">
        <MonthlyDeductionsTable />
        <RepaymentChart />
      </div> */}
      <RepaymentsHistoryTable />
    </div>
  );
}
