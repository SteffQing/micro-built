import UploadRepayment from "@/ui/modals/upload-repayment";
import { SectionCardsUserRepayment } from "./section-card";
import RepaymentsTable from "./table";
import PageTitle from "@/components/page-title";

export function AdminRepaymentsPage() {
  return (
    <main className="p-3 lg:p-5 space-y-3 lg:space-y-5">
      <PageTitle title="Repayments" actionContent={<UploadRepayment />} />
      <SectionCardsUserRepayment />
      <RepaymentsTable />
    </main>
  );
}
