import { useQuery } from "@tanstack/react-query";
import { userRepaymentsOverview } from "@/lib/queries/user/repayment";
import ReportCard from "@/components/report-card";
import { formatCurrency } from "@/lib/utils";
import { DeductionsCard } from "@/ui/repayments/deductions-card";
import { icons } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";

export function SectionCardsUserRepayment() {
  const { data, isLoading } = useQuery(userRepaymentsOverview);
  const lastRepayment = data?.data?.lastRepayment;
  const thisMonth = data?.data?.thisMonth;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 justify-between w-full">
      <DeductionsCard
        next={thisMonth}
        last={lastRepayment}
        nextLabel="This month"
        loading={isLoading}
        className="sm:col-span-3 lg:col-span-2"
      />
      <ReportCard
        title="Repayments"
        value={(data?.data?.repaymentsCount || 0).toString()}
        icon={<IconTile icon={icons.checkCircle} tone="success" />}
        loading={isLoading}
        className="sm:col-span-1"
      />
      <ReportCard
        title="Outstanding"
        value={formatCurrency(data?.data?.outstanding)}
        icon={<IconTile icon={icons.calendarClock} tone="warning" />}
        loading={isLoading}
        className="sm:col-span-1"
      />
      <ReportCard
        title="Missed"
        value={(data?.data?.missedCount || 0).toString()}
        icon={<IconTile icon={icons.alertTriangle} tone="danger" />}
        loading={isLoading}
        className="sm:col-span-1"
      />
    </div>
  );
}
