import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { processStatusData } from "./utils";
import { DonutChart } from "./donut-chart";
import { ChartLegend } from "./chart-legend";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueryObserverResult, RefetchOptions } from "@tanstack/react-query";

interface LoanStatusChartProps {
  statusDistribution: LoanReportStatusDistributionDto;
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<ApiRes<LoanReportStatusDistributionDto>, Error>>;
  isRefetching: boolean;
  showRawCounts?: boolean;
  chartSize?: number;
}

export function LoanStatusChart({
  statusDistribution,
  refetch,
  isRefetching,
  showRawCounts = false,
  chartSize = 200,
}: LoanStatusChartProps) {
  const { segments, total } = processStatusData(statusDistribution.statusCounts);

  if (total === 0) {
    return (
      <Card className="bg-white h-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Loan Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-muted-foreground text-center">
              <p className="text-sm">No loan data available</p>
              <p className="text-xs mt-1">Check back when loans are created</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <section className="flex items-center justify-between">
        <CardTitle className="text-lg font-semibold">Loan Status Distribution</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </section>
      <CardContent>
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <DonutChart segments={segments} size={chartSize} />

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-sm text-muted-foreground">Total Loans</p>
              <p className="text-2xl font-bold">{total.toLocaleString()}</p>
            </div>
          </div>

          <ChartLegend segments={segments} showRawCounts={showRawCounts} />
        </div>
      </CardContent>
    </Card>
  );
}
