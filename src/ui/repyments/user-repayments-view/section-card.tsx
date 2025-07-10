import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { IconsIllustration } from "@/components/icons-illustrations";
import { useQuery } from "@tanstack/react-query";
import { userRepaymentsOverviewOption } from "@/lib/queries/repayment-overview";

export function SectionCardsUserRepayment() {
  const { data, isLoading, isError, error } = useQuery({
    ...userRepaymentsOverviewOption,
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
          <div className="text-muted-foreground">Repayments Count</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {data?.data?.repaymentsCount || 0}
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
          <div className="text-muted-foreground">Missed Repayments</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {data?.data?.overdueAmount || 0}
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
          <div className="text-muted-foreground">Flagged Repayments</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {data?.data?.flaggedRepaymentsCount || 0}
          </div>
        </CardFooter>
      </Card>
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
