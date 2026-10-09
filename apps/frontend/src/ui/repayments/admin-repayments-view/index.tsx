import { SectionCardsUserRepayment } from "./section-card";
import InflowsTable from "./table";
import { DeductionsTab } from "./deductions-table";
import { AppliedTab } from "./applied-table";
import PageTitle from "@/components/page-title";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InflowDetailsModal } from "@/ui/modals/repayments/inflow-details";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["deductions", "inflows", "repayments"] as const;

export function AdminRepaymentsPage() {
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });
  // Notification links land here: ?tab=inflows&inflow=<id> opens that inflow (e.g. a liquidation to review).
  const params = useSearchParams();
  const linkedTab = params.get("tab");
  const initialTab = TABS.find((t) => t === linkedTab) ?? "inflows";
  const linkedInflow = params.get("inflow");
  // ?voucher=<id> narrows the Inflows table to one voucher; the chip clears it. (?upload= is what links used before
  // uploads were renamed to vouchers.)
  const linkedVoucher = params.get("voucher") ?? params.get("upload") ?? undefined;
  const router = useRouter();
  const pathname = usePathname();
  function clearVoucher() {
    const next = new URLSearchParams(params.toString());
    next.delete("voucher");
    next.delete("upload");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <main className="p-3 lg:p-5 space-y-3 lg:space-y-5">
      <PageTitle
        title="Repayments"
        actionContent={
          // The modal triggers set their own heights, so the row pins direct-child buttons to h-9.
          <div className="flex flex-wrap items-center gap-2 sm:justify-end [&>button]:h-9">
            <PeriodRangeFilter value={period} onChange={setPeriod} />
          </div>
        }
      />
      <SectionCardsUserRepayment period={period} />

      {/* Keyed by the link, so following another notification while here switches tab and opens it. */}
      {linkedInflow && (
        <InflowDetailsModal key={linkedInflow} id={linkedInflow} defaultOpen trigger={<span className="hidden" />} />
      )}
      <Tabs key={`${initialTab}-${linkedInflow ?? ""}`} defaultValue={initialTab}>
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="deductions">Deductions</TabsTrigger>
            <TabsTrigger value="inflows">Inflows</TabsTrigger>
            <TabsTrigger value="repayments">Repayments</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="deductions" className="mt-4">
          <DeductionsTab period={period} />
        </TabsContent>
        <TabsContent value="inflows" className="mt-4">
          <InflowsTable period={period} voucherId={linkedVoucher} onClearVoucher={clearVoucher} />
        </TabsContent>
        <TabsContent value="repayments" className="mt-4">
          <AppliedTab period={period} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
