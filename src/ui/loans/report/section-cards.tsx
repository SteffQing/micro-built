import {
  Card,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconsIllustration } from "@/components/icons-illustrations";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { loanReportOverview } from "@/lib/queries/admin/dashboard";
import { formatCurrency } from "@/lib/utils";

export function SectionCardsLoanManagement() {
  const { data } = useQuery(loanReportOverview);
  return (
    <div className="grid grid-cols-1 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3 @5xl/main:grid-cols-5">
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.money_out_icon className="h-10" />
          </CardTitle>
          <CardAction className="text-sm text-primary/80 flex items-center gap-1 font-medium">
            <Link href="/loans">See all</Link>
            <ChevronRight className="w-4 h-4" />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Amount Disbursed</div>
          <div className="line-clamp-1 text-xl flex gap-2 font-medium">
            {formatCurrency(data?.data?.totalDisbursed)}
          </div>
        </CardFooter>
      </Card>

      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.alert_document className="h-10" />
          </CardTitle>
          {/* <CardAction>
            <Badge variant="destructive">High Risk</Badge>
          </CardAction> */}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Amount Repaid</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {formatCurrency(data?.data?.totalRepaid)}
          </div>
        </CardFooter>
      </Card>

      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.earnings className="h-10" />
          </CardTitle>
          {/* <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +12%
            </Badge>
          </CardAction> */}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Interests Earned</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {formatCurrency(data?.data?.interestEarned)}
          </div>
        </CardFooter>
      </Card>

      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.active_document className="h-10" />
          </CardTitle>
          {/* <CardAction>
            <Badge
              variant="outline"
              className="bg-green-50 text-green-600 border-green-200"
            >
              <IconTrendingUp />
              +12%
            </Badge>
          </CardAction> */}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Active Loans</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {data?.data?.activeLoansCount ?? 0}
          </div>
        </CardFooter>
      </Card>

      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.completed_document className="h-10" />
          </CardTitle>
          {/* <CardAction>
            <Button variant="outline" size="sm">
              View
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardAction> */}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Pending Loans</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {data?.data?.pendingLoansCount ?? 0}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
