"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { statusDistribution } from "@/lib/queries/admin/dashboard";
import { useQuery } from "@tanstack/react-query";
import { LoanStatusChart } from "./loan-status-chart";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoanStatusDistributionProps {
  showRawCounts?: boolean;
  chartSize?: number;
  enableRefresh?: boolean;
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-6">
          <Skeleton className="w-[200px] h-[200px] rounded-full" />
          <div className="space-y-3 w-full">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="w-20 h-4" />
                </div>
                <Skeleton className="w-12 h-4" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load loan status data: {error.message}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export default function LoanStatusDistribution({
  showRawCounts = false,
  chartSize = 200,
  enableRefresh = true,
}: LoanStatusDistributionProps) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    ...statusDistribution,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  }

  if (!data?.data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>No data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      {enableRefresh && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
          />
        </Button>
      )}
      <LoanStatusChart
        statusDistribution={data.data}
        showRawCounts={showRawCounts}
        chartSize={chartSize}
      />
    </div>
  );
}
