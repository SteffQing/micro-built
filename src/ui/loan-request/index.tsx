import { SectionCardsUserDashboard } from "./section-card";
import UserLoanRequestHistoryTable from "./table";
import RequestLoanModal from "../modals/request-loan";
import PageTitle from "@/components/page-title";
import CommodityLoanApplications from "./table/commodity-loan";

export function UserLoanRequestPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <PageTitle title="Loan/Asset Request" actionContent={<RequestLoanModal />} />
      <SectionCardsUserDashboard />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UserLoanRequestHistoryTable />
        </div>
        <CommodityLoanApplications />
      </div>
    </div>
  );
}
