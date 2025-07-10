"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { Search, Filter, MoreHorizontal } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type RepaymentStatus } from "@/lib/queries/query-types";
import { useQuery } from "@tanstack/react-query";
import {
  adminRepaymentsHistoryQueryOptions,
  AdminRepaymentsHistoryResponse,
  UserRepaymentsHistory,
  userRepaymentsHistoryQueryOptions,
} from "@/lib/queries/repayments-history";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

// import { TablePagination } from "./table-pagination";
// import { useRepaymentHistory } from "@/lib/queries/repayment-history";
// import type { AdminRepaymentsHistoryResponse } from "@/lib/queries/repayments-history";

type RepaymentHistoryColumn = AdminRepaymentsHistoryResponse["data"][0];

export function RepaymentsHistoryTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    RepaymentStatus | "AWAITING"
  >("AWAITING");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isLoading } = useQuery({
    ...adminRepaymentsHistoryQueryOptions({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    }),
  });

  const columns: ColumnDef<RepaymentHistoryColumn>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue("id")}</span>
      ),
    },
    {
      accessorKey: "userId",
      header: "Customer ID",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("userId")}</span>
      ),
    },
    {
      accessorKey: "expectedAmount",
      header: "Expected Amount",
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.getValue("expectedAmount"))}
        </span>
      ),
    },
    {
      accessorKey: "repaidAmount",
      header: "Amount Repaid",
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.getValue("repaidAmount"))}
        </span>
      ),
    },
    {
      accessorKey: "period",
      header: "Period",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue("period")}</span>
      ),
    },
    {
      header: "View",
      cell: ({ row }) => (
        <Dialog>
          <DialogTrigger>
            <Button variant="outline">View</Button>
          </DialogTrigger>
          <DialogContent></DialogContent>
        </Dialog>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.data || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    manualPagination: true,
    // pageCount: data ? Math.ceil(data.meta.total / data?.meta.limit) : 0,
  });

  return (
    <Card className="bg-background w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">
          Repayments History
        </CardTitle>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardHeader>
      <Separator />
      <CardContent>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search"
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(String(event.target.value))}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as RepaymentStatus | "AWAITING")
            }
          >
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="FULFILLED">Paid off</SelectItem>
              <SelectItem value="OVERPAID">Overpaid</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="AWAITING">Awaiting</SelectItem>
              <SelectItem value="MANUAL_RESOLUTION">
                Manual Resolution
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />

        <div>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-muted-foreground font-medium"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableLoadingSkeleton columns={7} />
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableEmptyState colSpan={7} />
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
