"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import columns from "./columns";
import { allRepayments } from "@/lib/queries/admin/repayment";
import { RepaymentStatus } from "@/config/enums";
import { TablePagination } from "@/ui/tables/pagination";
import { useFilters } from "@/components/filters/useFilters";
import {
  FilterBuilder,
  FilterConfig,
} from "@/components/filters/FilterBuilder";
import { Card } from "@/components/ui/card";
import { capitalize } from "@/lib/utils";

const filterConfig: FilterConfig[] = [
  {
    key: "search",
    type: "text",
    label: "Search Customers",
    placeholder: "Search by name, email or IPPIS ID",
    showSearchIcon: true,
  },
  {
    key: "status",
    type: "select",
    label: "Repayment Status",
    options: [
      { label: "All", value: "undefined" },

      ...Object.values(RepaymentStatus).map((status) => ({
        label: capitalize(status.replace(/_/g, " ")),
        value: status,
      })),
    ],
  },
  {
    key: "period",
    type: "date",
    label: "Repayment Period",
    placeholder: "Pick a date range",
  },
  {
    key: "hasPenaltyCharge",
    type: "checkbox",
    label: "Has Penalty Charge",
    description: "Show repayments with penalty charge only",
  },
  {
    key: "repaidAmount",
    type: "range",
    label: "Repaid Amount",
    format: "currency",
    min: 1000,
    max: 10_000_000,
    step: 1000,
  },
];

export default function RepaymentsTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const initialState = React.useMemo(
    () =>
      Object.fromEntries(filterConfig.map((filter) => [filter.key, undefined])),
    []
  );

  const { filters, setFilter, clearFilters, qDto, qString } = useFilters({
    initialState,
  });

  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Reset pagination when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [qString]);

  const { data, isLoading } = useQuery(
    allRepayments({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...qDto,
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
        ...qDto,
      };

      queryClient.prefetchQuery(allRepayments(nextPageParams));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.pageIndex, pagination.pageSize, qString, data, queryClient]);

  return (
    <Card className="bg-background rounded-xl p-4 border gap-0">
      <div className="flex gap-4 items-center justify-between py-4 px-4 w-full">
        <h1 className="text-lg font-semibold">Repayments Data</h1>
        <FilterBuilder
          config={filterConfig}
          state={filters}
          onChange={setFilter}
          onClear={clearFilters}
          triggerLabel="Filters"
          side="right"
        />
      </div>

      <Table>
        <TableHeader className="px-4">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="font-medium text-sm text-muted-foreground"
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
            <TableLoadingSkeleton columns={7} rows={10} />
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="border-b hover:bg-gray-50 bg-background"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableEmptyState
              colSpan={7}
              title="No recent repayments"
              description={`There are no repayments for the current filters.`}
            />
          )}
        </TableBody>
      </Table>

      <div className="py-4 px-4">
        <TablePagination table={table} />
      </div>
    </Card>
  );
}
