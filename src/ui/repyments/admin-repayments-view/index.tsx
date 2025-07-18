import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoanApplicationModal } from "@/ui/dashboard/user-dashboard/loan-application-dialog";
import { SectionCardsUserRepayment } from "./section-card";
import RepaymentsTable from "./table";
import PageTitle from "@/components/page-title";

export function AdminRepaymentsPage() {
  return (
    <main className="min-h-screen bg-[#fafafa] p-3 lg:p-5 flex flex-col gap-3 lg:gap-5">
      <PageTitle
        title="Repayments"
        downloadReport={{ action: () => {}, loading: false }}
      />
      <SectionCardsUserRepayment />
      <RepaymentsTable />
    </main>
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
