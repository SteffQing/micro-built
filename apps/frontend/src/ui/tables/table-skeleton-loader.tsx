import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

// Cells vary in width the way real values do; fixed, so the server and the browser agree.
const WIDTHS = ["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4", "w-2/5"];

export function TableLoadingSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRow key={index} aria-hidden className="hover:bg-transparent">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={colIndex} className="py-4">
              {colIndex === 0 ? (
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-7 shrink-0 rounded-full" />
                  <Skeleton className={cn("h-3.5", WIDTHS[index % WIDTHS.length])} />
                </div>
              ) : (
                <Skeleton className={cn("h-3.5", WIDTHS[(index + colIndex) % WIDTHS.length])} />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
