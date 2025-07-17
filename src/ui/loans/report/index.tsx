import { SiteSubHeader } from "@/components/site-sub-header";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCardsLoanManagement } from "./section-cards";
import LoanDisbursementChart from "../../dashboard/admin-dashboard/chart-area-intective";
import LoanStatusDistribution from "./loan-status-distribution";

export default function LoanReportView() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Loan management", isCurrentPage: true }]}
        rightContent={<HeaderRightContent />}
      />
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

const HeaderRightContent = () => {
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary">
        Quick Action <ChevronDown className="w-3 h-3" />
      </Button>
      {/* <LoanApplicationModal /> */}
    </div>
  );
};
