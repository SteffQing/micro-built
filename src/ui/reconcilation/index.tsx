import { SectionCardsUserRepayment } from "./section-card";
import ReconcilationsTable from "./table";
import PageTitle from "@/components/page-title";

export function AdminReconcilationPage() {
  return (
    <main className="p-3 lg:p-5 space-y-3 lg:space-y-5">
      <PageTitle
        title="Reconciliation Tool"
        downloadReport={{ action: () => {}, loading: false }}
      />
      <SectionCardsUserRepayment />
      <ReconcilationsTable />
    </main>
  );
}
