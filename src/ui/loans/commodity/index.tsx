"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { TableLoadingSkeleton } from "../../tables/table-skeleton-loader";
import { TableEmptyState } from "../../tables/table-empty-state";
import columns from "./columns";
import { TablePagination } from "@/ui/tables/pagination";
import { allCommodityLoans } from "@/lib/queries/admin/commodity-loans";
import { format } from "date-fns";
import { useFilters } from "@/components/filters/useFilters";
import {
  FilterBuilder,
  FilterConfig,
} from "@/components/filters/FilterBuilder";
import { Separator } from "@/components/ui/separator";

const filterConfig: FilterConfig[] = [
  {
    key: "search",
    type: "text",
    label: "Search",
    placeholder: "Search by customer or asset name",
    showSearchIcon: true,
  },
  {
    key: "status",
    type: "select",
    label: "Status",
    options: [
      { label: "All Loans", value: "all" },
      { label: "In Review", value: "true" },
      { label: "Accepted", value: "false" },
    ],
  },
  {
    key: "date",
    type: "date",
    label: "Date Range",
    placeholder: "Filter by date",
  },
];

export default function CommodityLoansTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const { filters, setFilter, clearFilters, debouncedFilters } = useFilters({
    initialState: {
      search: "",
      status: undefined,
      date: undefined,
    },
    debounceMs: 500,
  });

  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Reset pagination when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [debouncedFilters]);

  const dateRange = debouncedFilters.date as
    | {
        start?: Date;
        end?: Date;
      }
    | undefined;

  const { data, isLoading } = useQuery(
    allCommodityLoans({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      search: debouncedFilters.search as string,
      ...(debouncedFilters.status && debouncedFilters.status !== "all"
        ? { inReview: debouncedFilters.status === "true" }
        : {}),
      from: dateRange?.start
        ? format(dateRange.start, "yyyy-MM-dd")
        : undefined,
      to: dateRange?.end ? format(dateRange.end, "yyyy-MM-dd") : undefined,
    })
  );

  const table = useReactTable({
    data: data?.data || [],
    columns,
    rowCount: data?.meta?.total || 0,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
  });

  // Prefetch next page
  useEffect(() => {
    const currentPage = pagination.pageIndex + 1;
    const totalPages = data?.meta?.total
      ? Math.ceil(data.meta.total / pagination.pageSize)
      : 0;
    const hasNextPage = currentPage < totalPages;

    if (hasNextPage && data) {
      const nextPageParams = {
        page: currentPage + 1,
        limit: pagination.pageSize,
        search: debouncedFilters.search as string,
        ...(debouncedFilters.status && debouncedFilters.status !== "all"
          ? { inReview: debouncedFilters.status === "true" }
          : {}),
        from: dateRange?.start
          ? format(dateRange.start, "yyyy-MM-dd")
          : undefined,
        to: dateRange?.end ? format(dateRange.end, "yyyy-MM-dd") : undefined,
      };

      queryClient.prefetchQuery(allCommodityLoans(nextPageParams));
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    debouncedFilters,
    data,
    queryClient,
    dateRange,
  ]);

  return (
    <Card className="bg-background border gap-0">
      <div className="flex gap-4 items-center justify-between py-4 px-4 w-full">
        <h1 className="text-lg font-semibold">Commodity Loan Applications</h1>
        <FilterBuilder
          config={filterConfig}
          state={filters}
          onChange={setFilter}
          onClear={clearFilters}
          triggerLabel="Filters"
          side="right"
        />
      </div>

      <CardContent className="p-0">
        <div className="rounded-md">
          <Table>
            <TableHeader className="px-4">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        className="font-medium text-muted-foreground"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingSkeleton columns={7} rows={10} />
              ) : !isLoading && table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-4">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableEmptyState
                  colSpan={7}
                  title="No commodity loans to review"
                  description="There are currently no commodity loans with the selected filters."
                />
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="py-4 px-4">
            <TablePagination table={table} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
