import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { adminRepaymentsOverviewOption } from "@/lib/queries/repayment-overview";

export function SectionCardsUserRepayment() {
  const { data, isLoading, isError, error } = useQuery({
    ...adminRepaymentsOverviewOption,
  });
  console.log({ data, isLoading, isError, error });

  return (
    <div className="lg:grid lg:grid-cols-4 flex flex-col gap-2 justify-between w-full">
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.pending_contract className="h-10" />
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Total Expenditure</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {data?.data?.totalExpected || 0}
          </div>
        </CardFooter>
      </Card>
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.approved_contract className="h-10" />
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Total Amount Repaid</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {data?.data?.totalRepaid || 0}
          </div>
        </CardFooter>
      </Card>
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.rejected_contract className="h-10" />
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Underpayments</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {data?.data?.underpaymentsCount || 0}
          </div>
        </CardFooter>
      </Card>
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.disbursed_contract className="h-10" />
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Failed Deductions</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {data?.data?.failedDeductionsCount || 0}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
