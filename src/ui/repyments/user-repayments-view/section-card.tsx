import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { userRepaymentsOverview } from "@/lib/queries/user/repayment";
import ReportCard from "@/components/report-card";
import { formatDate } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export function SectionCardsUserRepayment() {
  const { data, isLoading } = useQuery(userRepaymentsOverview);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 justify-between w-full">
      <div className="bg-white border border-[#F0F0F0] rounded-[12px] p-4 lg:p-5 flex flex-col gap-2 w-full relative justify-between sm:col-span-3 lg:col-span-2">
        {" "}
        <div className="flex flex-col gap-2">
          <p className="text-[#999999] text-xs font-normal">Next Repayment</p>
          <p className="text-[#666666] font-medium text-base">
            {data?.data?.nextRepaymentDate ? formatDate(data.data.nextRepaymentDate, "PPP") : "No upcoming payment"}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[#999999] text-xs font-normal">Last Repayment</p>
          <p className="text-[#666666] font-medium text-base">
            {data?.data?.lastRepaymentDate ? formatDate(data.data.lastRepaymentDate, "PPP") : "No recent payment"}
          </p>
        </div>
      </div>
      <ReportCard
        title="Repayments"
        value={(data?.data?.repaymentsCount || 0).toString()}
        icon={<IconsIllustration.pending_contract className="h-10" />}
        loading={isLoading}
        className="sm:col-span-1"
      />
      <ReportCard
        title="Missed Repayments"
        value={formatCurrency(data?.data?.overdueAmount || 0)}
        icon={<IconsIllustration.approved_contract className="h-10" />}
        loading={isLoading}
        className="sm:col-span-1"
      />
      <ReportCard
        title="Flagged Repayments"
        value={(data?.data?.flaggedRepaymentsCount || 0).toString()}
        icon={<IconsIllustration.rejected_contract className="h-10" />}
        loading={isLoading}
        className="sm:col-span-1"
      />
    </div>
  );
}
