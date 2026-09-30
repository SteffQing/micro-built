import { SectionCardsLoanManagement } from "./section-cards";
import LoanDisbursementChart from "../../dashboard/admin-dashboard/chart-area-intective";
import LoanStatusDistribution from "./loan-status-distribution";
import PageTitle from "@/components/page-title";

export default function LoanReportView() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <PageTitle title="Loan Report" />
      <SectionCardsLoanManagement />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LoanDisbursementChart />
        </div>
        <LoanStatusDistribution />
      </div>
    </div>
  );
}
