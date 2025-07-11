import { IconTrendingDown } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { adminOverviewQueryOption } from "@/lib/queries/admin-overview";

export function SectionCardsAdminDashboad() {
  const { data } = useQuery({
    ...adminOverviewQueryOption,
  });

  const { activeCount, pendingCount, grossProfit, totalDisbursed } =
    data?.data || {};
  console.log({ data });

  return (
    <div className="grid grid-cols-1 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-4 @5xl/main:grid-cols-4">
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className=" font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.contracts_list className="h-10" />
          </CardTitle>
          <CardAction className="text-sm text-primary/80 flex items-center gap-1 font-medium">
            <Link href="/admin">See all</Link>
            <ChevronRight className="w-4 h-4" />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Total active loans</div>
          <div className="line-clamp-1 text-xl flex gap-2 font-medium">
            {activeCount || 0}
          </div>
        </CardFooter>
      </Card>
      <Card className=" bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.database className="h-10" />
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingDown />
              -20%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Total Amount Disbursed</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {totalDisbursed || 0}
          </div>
        </CardFooter>
      </Card>
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.naira className="h-10" />
          </CardTitle>
          <CardAction>
            {/* <Badge variant="outline">
              <IconTrendingUp />
              +20%
            </Badge> */}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Gross Profit</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {grossProfit || 0}
          </div>
        </CardFooter>
      </Card>

      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.document className="h-10" />
          </CardTitle>
          <CardAction>
            <Button variant="outline" size="sm">
              See all
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Pending Loans</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            {pendingCount || 0}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
