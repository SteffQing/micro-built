import { useUserProvider } from "@/store/auth";
import CloseRepaymentPeriod from "@/ui/modals/close-repayment-period";
import UploadRepayment from "@/ui/modals/upload-repayment";
import { SectionCardsUserRepayment } from "./section-card";
import RepaymentsTable from "./table";
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
          <TabsTrigger value="liquidations">Liquidations</TabsTrigger>
        </TabsList>
        <TabsContent value="deductions" className="mt-4">
          <DeductionsTab />
        </TabsContent>
        <TabsContent value="inflows" className="mt-4">
          <InflowsTab />
        </TabsContent>
        <TabsContent value="liquidations" className="mt-4">
          <LiquidationsTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function DeductionsTab() {
  return <RepaymentsTable />;
}

function InflowsTab() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
      Payment inflows by state with manual resolution will appear here.
    </div>
  );
}

function LiquidationsTab() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
      Liquidation requests will appear here.
    </div>
  );
}
