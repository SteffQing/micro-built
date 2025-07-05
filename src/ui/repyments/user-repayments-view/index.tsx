import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteSubHeader } from "@/components/site-sub-header";
import { LoanApplicationModal } from "@/ui/dashboard/user-dashboard/loan-application-dialog";
import { SectionCardsUserRepayment } from "./section-card";
import { RepaymentsHistoryTable } from "./repayments-history-table";
import { RepaymentChart } from "./repayment-chart";

export function UserRepaymentsPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Repayments", isCurrentPage: true }]}
        rightContent={<HeaderRightContent />}
      />
      <SectionCardsUserRepayment />
      <div>
        <RepaymentChart />
      </div>
      <RepaymentsHistoryTable />
    </div>
  );
}

const HeaderRightContent = () => {
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm">
        Quick Action <ChevronDown className="w-3 h-3" />
      </Button>
      <LoanApplicationModal />
    </div>
  );
};
