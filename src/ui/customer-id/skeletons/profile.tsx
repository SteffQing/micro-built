import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomerProfileCardSkeleton() {
  return (
    <Card className="p-5 bg-background">
      <div className="space-y-2 flex flex-col justify-between h-full">
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
          <div className="py-1 px-[10px] w-fit rounded-[4px] flex gap-2 items-center border">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="flex gap-4 justify-between items-center border border-border rounded-[4px] p-3">
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
    <Card className="h-full gap-0 bg-background p-0">
      <div className="flex items-center justify-between px-5 py-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid grid-cols-2">
        {["border-b border-r", "border-b", "border-r", ""].map((border, i) => (
          <div key={i} className={`space-y-2 border-[#eee] p-5 ${border}`}>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}
