import { useUserProvider } from "@/store/auth";
import CloseRepaymentPeriod from "@/ui/modals/close-repayment-period";
import UploadRepayment from "@/ui/modals/upload-repayment";
import { SectionCardsUserRepayment } from "./section-card";
import RepaymentsTable from "./table";
import PageTitle from "@/components/page-title";

export function AdminRepaymentsPage() {
  const { userRole } = useUserProvider();

  return (
    <main className="p-3 lg:p-5 space-y-3 lg:space-y-5">
      <PageTitle
        title="Repayments"
        actionContent={
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <UploadRepayment />
            {userRole === "SUPER_ADMIN" && <CloseRepaymentPeriod />}
          </div>
        }
      />
      <SectionCardsUserRepayment />
      <RepaymentsTable />
    </main>
  );
}
