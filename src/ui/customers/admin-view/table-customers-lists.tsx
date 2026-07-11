"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";

import { TablePagination } from "../../tables/pagination";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";

import { customersList, getOrganizations } from "@/lib/queries/admin/customers";
import { accountOfficers } from "@/lib/queries/admin/account-officer";
import columns from "./column";
import { Card } from "@/components/ui/card";
import { useFilters } from "@/components/filters/useFilters";
import { ExportButton } from "@/ui/tables/export-button";
// import { TableSummaryCards } from "@/ui/tables/summary-cards";
import {
  FilterBuilder,
  FilterConfig,
} from "@/components/filters/FilterBuilder";
import { UserStatus } from "@/config/enums";
import { capitalize } from "@/lib/utils";
import MobileCustomerList from "../shared/mobile-customer-list";
import PeriodFilter from "@/components/period-filter";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// `search` and `signup` live in the toolbar, not the drawer — but they still
// belong in initialState below so Clear Filters resets them.
const filterConfig: FilterConfig[] = [
  {
    key: "status",
    type: "select",
    label: "Customer Status",
    options: [
      { label: "All Status", value: "undefined" },
      ...Object.values(UserStatus).map((status) => ({
        label: capitalize(status.replace(/_/g, " ")),
        value: status,
      })),
    ],
  },
  {
    key: "repaymentRate",
    type: "range",
    label: "Repayment Rate (%)",
  },
  {
    key: "grossPay",
    type: "range",
    label: "Gross Pay Range",
    min: 70_000,
    max: 10_000_000,
    step: 10_000,
  },
  {
    key: "netPay",
    type: "range",
    label: "Net Pay Range",
    min: 50_000,
    max: 10_000_000,
    step: 10_000,
  },
  {
    key: "organization",
    type: "async-select",
    label: "Organization",
    placeholder: "Select Organization to filter by",
    query: getOrganizations,
    labelKey: "name",
    valueKey: "id",
  },
  {
    key: "accountOfficerId",
    type: "async-select",
    label: "Account Officer",
    placeholder: "Select Account Officer",
    query: accountOfficers,
    labelKey: "name",
    valueKey: "id",
  },

  {
    key: "hasActiveLoan",
    type: "checkbox",
    label: "Active Loans Only",
    description: "Show customers with active loans only",
  },
];

export default function CustomersListTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const initialState = useMemo(
    () =>
      Object.fromEntries(
        [...filterConfig.map((filter) => filter.key), "search", "signup"].map(
          (key) => [key, undefined]
        )
      ),
    []
  );
  const { filters, setFilter, clearFilters, qDto, qString } = useFilters({
    initialState,
  });

  const queryClient = useQueryClient();

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 12,
  });
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [qString]);

  const { data, isLoading } = useQuery(
    customersList({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...qDto,
    })
  );

  const table = useReactTable({
    data: data?.data || [],
    columns,

    rowCount: data?.meta?.total || 0,
    pageCount: data?.meta ? Math.ceil(data.meta.total / data.meta.limit) : 0,

    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),

    manualPagination: true,

    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,

    onPaginationChange: setPagination,

    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
  });

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

      queryClient.prefetchQuery(customersList(nextPageParams));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.pageIndex, pagination.pageSize, qString, data, queryClient]);

  // Same inline period control as the dashboard/loan-report pages, driving the
  // existing "signup" filter key so it stays in sync with the Filters drawer.
  const signupRange = (filters.signup ?? {}) as { start?: Date; end?: Date };
  const toDateInput = (date?: Date) =>
    date ? date.toISOString().slice(0, 10) : "";

  return (
    <Card className="bg-background gap-0 overflow-hidden rounded-xl p-0">
      <div className="border-b px-4 py-4 sm:px-5">
        <h1 className="text-base font-semibold sm:text-lg">Customers List</h1>
      </div>

      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-[#999]" />
            <Input
              type="search"
              placeholder="Search"
              aria-label="Search customers"
              value={(filters.search as string) ?? ""}
              onChange={(e) => setFilter("search", e.target.value || undefined)}
              className="h-9 rounded-lg border-[#e8e8e8] bg-[#fafafa] pl-9 text-sm"
            />
          </div>
          <PeriodFilter
            from={toDateInput(signupRange.start)}
            to={toDateInput(signupRange.end)}
            onChange={(from, to) =>
              setFilter(
                "signup",
                from || to
                  ? {
                      ...(from && { start: new Date(from) }),
                      ...(to && { end: new Date(to) }),
                    }
                  : undefined
              )
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <ExportButton path="/admin/exports/customers" filters={qDto} />
          <FilterBuilder
            config={filterConfig}
            state={filters}
            onChange={setFilter}
            onClear={clearFilters}
            triggerLabel="Filter"
            side="right"
          />
        </div>
      </div>

      {/* Parked: averaged the current page's rows only. Belongs in the section
          cards, which needs `avgRepaymentRate` on the customers-overview endpoint.
      <TableSummaryCards
        rows={data?.data ?? []}
        fields={[
          {
            label: "Avg. Repayment Rate",
            value: (c) => c.repaymentRate,
            format: "percent",
            agg: "avg",
          },
        ]}
      /> */}

      <MobileCustomerList
        customers={data?.data || []}
        isLoading={isLoading}
        emptyTitle="No customers found"
        emptyDescription={`No customers found for ${
          filters.status ? filters.status : "current filters"
        }`}
      />

      <div className="hidden md:block">
      <Table className="min-w-[760px] text-sm">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-b hover:bg-transparent [&>th]:h-12 [&>th]:px-3 [&>th]:text-[13px] [&>th]:font-medium [&>th]:text-[#666] [&>th:first-child]:pl-5 [&>th:last-child]:pr-5"
            >
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
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
            <TableLoadingSkeleton columns={6} rows={10} />
          ) : !isLoading && table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="cursor-pointer border-b hover:bg-gray-50 [&>td]:px-3 [&>td]:py-3.5 [&>td]:text-sm [&>td]:text-[#666] [&>td:first-child]:pl-5 [&>td:last-child]:pr-5"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableEmptyState
              colSpan={6}
              title="No customers found"
              description={`No customers found for ${
                filters.status ? filters.status : "current filters"
              }`}
            />
          )}
        </TableBody>
      </Table>
      </div>

      {/* Pagination */}
      <div className="px-5 py-4">
        <TablePagination table={table} />
      </div>
    </Card>
  );
}
