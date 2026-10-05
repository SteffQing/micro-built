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
        titleAside={
          <div className="flex items-center [&>button]:h-9">
            <UploadRepayment />
          </div>
        }
        actionContent={
          // The modal triggers set their own heights, so the row pins direct-child buttons to h-9.
          <div className="flex flex-wrap items-center gap-2 sm:justify-end [&>button]:h-9">
            <PeriodRangeFilter value={period} onChange={setPeriod} />
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
