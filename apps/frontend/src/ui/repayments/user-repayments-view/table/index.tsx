"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { userRepaymentsHistory } from "@/lib/queries/user/repayment";
import columns from "./column";
import { TablePagination } from "@/ui/tables/pagination";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";

export default function RepaymentsHistoryTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const periodRange = period.from && period.to ? { from: period.from, to: period.to } : undefined;

  const { data, isLoading } = useQuery(
    userRepaymentsHistory({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...periodRange,
    })
  );

  const table = useReactTable({
    data: data?.data || [],
    columns: columns,
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
    pageCount: data ? Math.ceil(data?.meta!.total / data?.meta!.limit) : 0,
  });

  return (
    <Card className="bg-background w-full">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base font-semibold">Repayments History</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent>
        <div className="flex items-center gap-4 mb-6 w-full flex-wrap">
          <PeriodRangeFilter value={period} onChange={setPeriod} />
        </div>
        <Separator />

        <div>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="text-muted-foreground font-medium">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableLoadingSkeleton />
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableEmptyState colSpan={5} />
              )}
            </TableBody>
          </Table>
        </div>
        <div className="py-4 px-4">
          <TablePagination table={table} />
        </div>
      </CardContent>
    </Card>
  );
}
