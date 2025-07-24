import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { overview } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";
import ReportCard from "@/components/report-card";

export function SectionCardsAdminDashboad() {
  const { data } = useQuery(overview);

  const { activeCount, pendingCount, grossProfit, totalDisbursed } = data?.data || {};

  return (
    <div className="grid grid-cols-1 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs @xl/main:grid-cols-4 @5xl/main:grid-cols-4">
      <ReportCard
        title="Total active loans"
        icon={<IconsIllustration.contracts_list />}
        value={(activeCount || 0).toString()}
      />
      <ReportCard
        title="Total Amount Disbursed"
        icon={<IconsIllustration.database />}
        value={formatCurrency(totalDisbursed || 0)}
      />
      <ReportCard title="Gross Profit" icon={<IconsIllustration.naira />} value={formatCurrency(grossProfit || 0)} />
      <ReportCard title="Pending Loans" icon={<IconsIllustration.document />} value={(pendingCount || 0).toString()} />
    </div>
  );
}
