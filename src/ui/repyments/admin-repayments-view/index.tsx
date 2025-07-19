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
