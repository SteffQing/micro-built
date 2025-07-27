import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function ActiveLoansSkeleton() {
  return (
    <Card className="w-full bg-background">
      <CardHeader className="p-0 py-3 mb-3">
        <div className="flex items-center gap-2 px-5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="rounded-full w-6 h-6" />
        </div>
        <Separator className="bg-[#F5F5F5]" />
      </CardHeader>

      <CardContent className="space-y-4 p-0 px-5">
        <div className="grid gap-3 md:grid-cols-2">
          {/* First Loan Card */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>

            <Separator className="bg-[#F5F5F5]" />

            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>

            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>

            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>

            <div className="flex gap-2 justify-between">
              <div className="flex items-center gap-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-3" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>

            <Separator className="bg-[#F5F5F5]" />

            <div className="w-full">
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Second Loan Card */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>

            <Separator className="bg-[#F5F5F5]" />

            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>

            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>

            <div className="flex gap-2 justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>

            <div className="flex gap-2 justify-between">
              <div className="flex items-center gap-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-3" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>

            <Separator className="bg-[#F5F5F5]" />

            <div className="w-full">
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center pt-4">
          <div className="flex gap-2">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="w-2 h-2 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export function PendingApplicationsSkeleton() {
  return (
    <Card className="w-full bg-background">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* First Application */}
        <div className="flex flex-col gap-3 p-3 border rounded-[6px] border-[#F0F0F0]">
          <div className="flex items-center gap-3 justify-between">
            <div className="flex gap-1">
              <Skeleton className="w-6 h-1 rounded-[2px]" />
              <Skeleton className="w-6 h-1 rounded-[2px]" />
              <Skeleton className="w-6 h-1 rounded-[2px]" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-32 mt-5" />
          <div className="flex items-center gap-2 justify-between">
            <Skeleton className="h-6 w-20" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="w-2 h-4" />
            </div>
          </div>
        </div>

        {/* Second Application */}
        <div className="flex flex-col gap-3 p-3 border rounded-[6px] border-[#F0F0F0]">
          <div className="flex items-center gap-3 justify-between">
            <div className="flex gap-1">
              <Skeleton className="w-6 h-1 rounded-[2px]" />
              <Skeleton className="w-6 h-1 rounded-[2px]" />
              <Skeleton className="w-6 h-1 rounded-[2px]" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-28 mt-5" />
          <div className="flex items-center gap-2 justify-between">
            <Skeleton className="h-6 w-20" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="w-2 h-4" />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
