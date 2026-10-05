import { useUserProvider } from "@/store/auth";
import CloseRepaymentPeriod from "@/ui/modals/close-repayment-period";
import UploadRepayment from "@/ui/modals/upload-repayment";
import { SectionCardsUserRepayment } from "./section-card";
import InflowsTable from "./table";
import { DeductionsTab } from "./deductions-table";
import { AppliedTab } from "./applied-table";
import PageTitle from "@/components/page-title";
import { useState } from "react";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AdminRepaymentsPage() {
  const { userRole } = useUserProvider();
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });

  return (
    <main className="p-3 lg:p-5 space-y-3 lg:space-y-5">
      <PageTitle
        title="Repayments"
        actionContent={
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <PeriodRangeFilter value={period} onChange={setPeriod} />
            <UploadRepayment />
            {userRole === "SUPER_ADMIN" && <CloseRepaymentPeriod />}
          </div>
        }
      />
      <SectionCardsUserRepayment period={period} />

      <Tabs defaultValue="inflows">
        <TabsList>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="inflows">Inflows</TabsTrigger>
          <TabsTrigger value="repayments">Repayments</TabsTrigger>
        </TabsList>
        <TabsContent value="deductions" className="mt-4">
          <DeductionsTab period={period} />
        </TabsContent>
        <TabsContent value="inflows" className="mt-4">
          <InflowsTable period={period} />
        </TabsContent>
        <TabsContent value="repayments" className="mt-4">
          <AppliedTab period={period} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
