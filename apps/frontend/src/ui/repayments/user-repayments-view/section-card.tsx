import { useQuery } from "@tanstack/react-query";
import { userRepaymentsOverview } from "@/lib/queries/user/repayment";
import ReportCard from "@/components/report-card";
import { formatCurrency } from "@/lib/utils";
import { periodLabel, parseYm } from "@microbuilt/shared";
import { icons } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";

export function SectionCardsUserRepayment() {
  const { data, isLoading } = useQuery(userRepaymentsOverview);
  const lastRepayment = data?.data?.lastRepayment;
  const thisMonth = data?.data?.thisMonth;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 justify-between w-full">
      <div className="bg-card border border-border rounded-[12px] p-4 lg:p-5 flex flex-col gap-2 w-full relative justify-between sm:col-span-3 lg:col-span-2">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-normal">This Month</p>
          <p className="text-foreground font-medium text-base">
            {thisMonth
              ? `${formatCurrency(thisMonth.amount)} (${periodLabel(parseYm(thisMonth.period))})`
              : "No deduction this month"}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-normal">Last Repayment</p>
          <div className="flex items-baseline gap-2">
            <p className="text-foreground font-medium text-base">
              {lastRepayment
                ? formatCurrency(lastRepayment.amount)
                : "No previous deductions"}
            </p>
            {lastRepayment && (
              <span className="text-sm text-muted-foreground">
                {periodLabel(parseYm(lastRepayment.period))}
              </span>
            )}
          </div>
        </div>
      </div>
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
