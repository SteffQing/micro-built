import {  IconTrendingUp } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IconsIllustration } from "@/components/icons-illustrations";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function SectionCardsUserDashboard() {
  const totalLoan = 550000;
  const repaidAmount = 200000;
  const balance = totalLoan - repaidAmount;
  const repaymentProgress = (repaidAmount / totalLoan) * 100;
  return (
    <div className="grid grid-cols-4 gap-2 justify-between w-full *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3 @5xl/main:grid-cols-5">
      <Card className="col-span-2 bg-background">
        <CardHeader>
          <CardTitle className="flex items-center  justify-between gap-2">
            <p>Active Loan</p>
            <Badge variant="secondary" className="rounded-2xl">
              <div className="w-1 h-1 bg-primary rounded-full"></div>
              Active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-semibold">
            ₦{totalLoan.toLocaleString()}
          </p>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={repaymentProgress} className="h-2 bg-green-100" />
            <div className="flex justify-between text-sm">
              <div className="flex gap-1">
                <span className="text-muted-foreground">Repaid:</span>
                <span className="text-primary font-semibold text-sm">
                  {" "}
                  ₦{repaidAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex gap-1">
                <span className="text-muted-foreground">Balance:</span>
                <span className="text-primary font-semibold text-sm">
                  {" "}
                  ₦{balance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.naira className="h-10" />
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +20%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Gross Profit</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            1,000,200
          </div>
        </CardFooter>
      </Card>
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="font-semibold tabular-nums @[250px]/card:text-3xl">
            <IconsIllustration.percentage className="h-10" />
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              +20%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Net Margin</div>
          <div className="line-clamp-1 flex gap-2 font-medium text-xl">
            1,000,200
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
            1,000,200
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
