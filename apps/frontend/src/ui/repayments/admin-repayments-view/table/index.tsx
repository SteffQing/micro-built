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
import { useQuery, useQueryClient, useMutationState } from "@tanstack/react-query";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import columns from "./columns";
import { allRepayments } from "@/lib/queries/admin/repayment";
import { TablePagination } from "@/ui/tables/pagination";
import { useFilters } from "@/components/filters/useFilters";
import {
  FilterBuilder,
  FilterConfig,
} from "@/components/filters/FilterBuilder";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon, icons } from "@/components/icon";
import { capitalize } from "@/lib/utils";
import { ExportButton } from "@/ui/tables/export-button";
import { TableSummaryCards } from "@/ui/tables/summary-cards";

const filterConfig: FilterConfig[] = [
  {
    key: "search",
    type: "text",
    label: "Search Customers",
    placeholder: "Search by name, email or IPPIS ID",
    showSearchIcon: true,
  },
  {
    key: "state",
    type: "select",
    label: "Payment State",
    options: [
      { label: "All", value: "undefined" },
      { label: "Awaiting", value: "AWAITING" },
      { label: "Settled", value: "SETTLED" },
      { label: "Reviewing", value: "REVIEWING" },
      { label: "Unmatched", value: "UNMATCHED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },
  {
    key: "period",
    type: "period",
    label: "Repayment Period",
    placeholder: "Select period range",
  },
  {
    key: "repaidAmount",
    type: "range",
    label: "Amount",
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

  const successfulUploads = useMutationState({
    filters: { mutationKey: ["/admin/repayments/", "upload"], status: "success" },
    select: (mutation) => mutation.state.submittedAt,
  });
  const lastUpload = Math.max(0, ...successfulUploads);
  useEffect(() => {
    if (lastUpload) setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [lastUpload]);

  const { data, isLoading, isFetching } = useQuery({
    ...allRepayments({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...qDto,
    }),
    refetchInterval: 5_000,
  });

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getRowId: (row) => row.id,
    rowCount: data?.meta?.total || 0,
    pageCount: data?.meta ? Math.ceil(data.meta.total / data.meta.limit) : 0,
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
      <div className="flex flex-wrap items-center justify-between gap-2 py-4 px-4 w-full">
        <div>
          <h1 className="text-lg font-semibold">Repayments Data</h1>
          <p className="text-xs text-muted-foreground">
            Latest updates first · Refreshes every 5 seconds
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => {
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              void queryClient.invalidateQueries({ queryKey: ["/admin/repayments/"] });
            }}
          >
            <Icon icon={icons.refresh} size={16} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
          <ExportButton path="/admin/exports/repayments" filters={qDto} />
          <FilterBuilder
            config={filterConfig}
            state={filters}
            onChange={setFilter}
            onClear={clearFilters}
            triggerLabel="Filters"
            side="right"
          />
        </div>
      </div>

      <TableSummaryCards
        rows={data?.data ?? []}
        fields={[
          { label: "Total Amount", value: (r) => r.amount },
          { label: "Total Applied", value: (r) => r.applied },
        ]}
      />

      <div className="overflow-x-auto">
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
            <TableLoadingSkeleton columns={columns.length} rows={10} />
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="border-b hover:bg-muted/50 bg-background"
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
              colSpan={columns.length}
              title="No recent repayments"
              description={`There are no repayments for the current filters.`}
            />
          )}
        </TableBody>
      </Table>
      </div>

      <div className="py-4 px-4">
        <TablePagination table={table} />
      </div>
    </Card>
  );
}
