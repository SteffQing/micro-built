import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function RepaymentHistoryTableSkeleton() {
  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-10 w-20" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-12" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-12" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Row 1 */}
              <TableRow className="border-b hover:bg-gray-50">
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-6 w-16 rounded-[4px]" />
                </TableCell>
              </TableRow>

              {/* Row 2 */}
              <TableRow className="border-b hover:bg-gray-50">
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-6 w-16 rounded-[4px]" />
                </TableCell>
              </TableRow>

              {/* Row 3 */}
              <TableRow className="border-b hover:bg-gray-50">
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-6 w-16 rounded-[4px]" />
                </TableCell>
              </TableRow>

              {/* Row 4 */}
              <TableRow className="border-b hover:bg-gray-50">
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-6 w-16 rounded-[4px]" />
                </TableCell>
              </TableRow>

              {/* Row 5 */}
              <TableRow className="border-b hover:bg-gray-50">
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="py-4">
                  <Skeleton className="h-6 w-16 rounded-[4px]" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="py-4 px-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
