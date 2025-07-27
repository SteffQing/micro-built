import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { userRepaymentsOverview } from "@/lib/queries/user/repayment";
import ReportCard from "@/components/report-card";
import { formatDate } from "date-fns";

export function SectionCardsUserRepayment() {
  const { data, isLoading } = useQuery(userRepaymentsOverview);

  return (
    <div className="lg:grid lg:grid-cols-4 flex flex-col gap-2 justify-between w-full">
      <div className="bg-white border border-[#F0F0F0] rounded-[12px] p-4 lg:p-5 flex flex-col gap-2 w-full relative justify-between">
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
        title="Repayments Count"
        value={(data?.data?.repaymentsCount || 0).toString()}
        icon={<IconsIllustration.pending_contract className="h-10" />}
        loading={isLoading}
      />
      <ReportCard
        title="Missed Repayments"
        value={(data?.data?.overdueAmount || 0).toString()}
        icon={<IconsIllustration.approved_contract className="h-10" />}
        loading={isLoading}
      />
      <ReportCard
        title="Flagged Repayments"
        value={(data?.data?.flaggedRepaymentsCount || 0).toString()}
        icon={<IconsIllustration.rejected_contract className="h-10" />}
        loading={isLoading}
      />
      {/* <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.disbursed_contract className="h-10" />
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Disbursed Requests</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl"></div>
        </CardFooter>
      </Card> */}
    </div>
  );
}
