import { useUserProvider } from "@/store/auth";
import CloseRepaymentPeriod from "@/ui/modals/close-repayment-period";
import UploadRepayment from "@/ui/modals/upload-repayment";
import { SectionCardsUserRepayment } from "./section-card";
import InflowsTable from "./table";
import { DeductionsTab } from "./deductions-table";
import { AppliedTab } from "./applied-table";
import PageTitle from "@/components/page-title";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { InflowDetailsModal } from "@/ui/modals/repayments/inflow-details";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["deductions", "inflows", "repayments"] as const;

export function AdminRepaymentsPage() {
  const { userRole } = useUserProvider();
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });
  // Notification links land here: ?tab=inflows&inflow=<id> opens that inflow (e.g. a liquidation to review).
  const params = useSearchParams();
  const linkedTab = params.get("tab");
  const initialTab = TABS.find((t) => t === linkedTab) ?? "inflows";
  const linkedInflow = params.get("inflow");

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
            {userRole === "SUPER_ADMIN" && (
              // Pushed to the right end on phones too.
              <div className="ml-auto flex [&>button]:h-9 sm:ml-0">
                <CloseRepaymentPeriod />
              </div>
            )}
          </div>
        }
      />
      <SectionCardsUserRepayment period={period} />

      {/* Keyed by the link, so following another notification while here switches tab and opens it. */}
      {linkedInflow && (
        <InflowDetailsModal key={linkedInflow} id={linkedInflow} defaultOpen trigger={<span className="hidden" />} />
      )}
      <Tabs key={`${initialTab}-${linkedInflow ?? ""}`} defaultValue={initialTab}>
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
