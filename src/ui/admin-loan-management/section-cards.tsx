import { IconTrendingUp } from "@tabler/icons-react";

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

export function SectionCardsLoanDashboard() {
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
            ₦5,550,000
          </div>
        </CardFooter>
      </Card>

      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.earnings className="h-10" />
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +12%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Interests Earned</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            ₦2,200,050
          </div>
        </CardFooter>
      </Card>

      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.active_document className="h-10" />
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className="bg-green-50 text-green-600 border-green-200"
            >
              <IconTrendingUp />
              +12%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Active Loans</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            4,000
          </div>
        </CardFooter>
      </Card>

      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.completed_document className="h-10" />
          </CardTitle>
          <CardAction>
            <Button variant="outline" size="sm">
              View
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Closed Loans</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            1,000
          </div>
        </CardFooter>
      </Card>

      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.alert_document className="h-10" />
          </CardTitle>
          <CardAction>
            <Badge variant="destructive">High Risk</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Loans Defaulted</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">900</div>
        </CardFooter>
      </Card>
    </div>
  );
}
