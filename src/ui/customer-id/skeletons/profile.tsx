import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomerProfileCardSkeleton() {
  return (
    <Card className="p-5 bg-background">
      <div className="space-y-2 flex flex-col justify-between h-full">
        {/* Avatar and Name Section */}
        <div className="flex items-center gap-2 py-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="w-5 h-5" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        <Separator />

        {/* Contact Information */}
        <div className="flex items-end gap-4 justify-between py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>

          {/* Status Badge */}
          <div className="py-1 px-[10px] w-fit rounded-[4px] flex gap-2 items-center border">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-between items-center border border-[#F0F0F0] rounded-[4px] p-3">
          <div className="flex gap-1 items-center">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="flex gap-1 items-center">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function LoanSummarySkeleton() {
  return (
    <Card className="w-full bg-background">
      <CardHeader>
        <Skeleton className="h-6 w-28" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Total Loans */}
          <div className="relative space-y-2 rounded-xl border-r-2 border-b-2 border-secondary p-4">
            <Skeleton className="w-2 h-2 rounded-full absolute top-3 right-3" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Total Outstanding */}
          <div className="relative space-y-2 rounded-lg border-l-2 border-b-2 border-secondary p-4">
            <Skeleton className="w-2 h-2 rounded-full absolute top-3 right-3" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Defaulted Repayments */}
          <div className="relative space-y-2 rounded-lg border-r-2 border-t-2 border-secondary p-4">
            <Skeleton className="w-2 h-2 rounded-full absolute top-3 right-3" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Flagged Repayments */}
          <div className="relative space-y-2 rounded-lg border-l-2 border-t-2 border-secondary p-4">
            <Skeleton className="w-2 h-2 rounded-full absolute top-3 right-3" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
