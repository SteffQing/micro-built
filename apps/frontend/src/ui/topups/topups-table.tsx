"use client";

import { CustomerNameLink } from "@/components/customer-name-link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminTopups } from "@/lib/queries/admin/topups";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "./topup-actions";
import { TopupDetailsModal } from "./topup-details-modal";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBuilder, type FilterConfig } from "@/components/filters/FilterBuilder";
import { useFilters } from "@/components/filters/useFilters";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TablePagination } from "@/ui/tables/pagination";

// Moved with the actions; kept importable from here.
export { RepriceCheckbox, StatusBadge } from "./topup-actions";

const columns: ColumnDef<AdminTopupDto>[] = [
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <UserAvatar id={row.original.customer.id} name={row.original.customer.name} size={32} />
        <CustomerNameLink id={row.original.customer.id} name={row.original.customer.name} />
      </div>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {row.original.amount !== null ? formatCurrency(row.original.amount) : "—"}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "requested",
    header: "Requested",
    cell: ({ row }) => format(new Date(row.original.requestedAt), "PPP"),
  },
  {
    id: "disbursed",
    header: "Disbursed",
    cell: ({ row }) => (row.original.disbursedAt ? format(new Date(row.original.disbursedAt), "PPP") : "—"),
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => (
      <TopupDetailsModal
        id={row.original.id}
        trigger={
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon={icons.view} size={12} className="mr-1" />
            View
          </Button>
        }
      />
    ),
  },
];

const filterConfig: FilterConfig[] = [
  {
    key: "status",
    type: "select",
    label: "Status",
    options: [
      { label: "All Statuses", value: "undefined" },
      { label: "Pending", value: "PENDING" },
      { label: "Approved", value: "APPROVED" },
      { label: "Disbursed", value: "DISBURSED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },
];

export default function TopupsTable() {
  const initialState = useMemo(() => ({ status: undefined }), []);
  const { filters, setFilter, clearFilters, qDto, qString } = useFilters({ initialState });
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  // Back to the first page when the filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [qString]);

  const { data, isLoading } = useQuery(
    adminTopups({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(qDto.status ? { status: String(qDto.status) } : {}),
    })
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    rowCount: data?.meta?.total ?? 0,
    pageCount: data?.meta ? Math.ceil(data.meta.total / data.meta.limit) : 0,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <Card className="w-full bg-background border gap-0">
      <div className="flex flex-wrap items-center justify-between gap-2 py-4 px-4 w-full">
        <h1 className="text-lg font-semibold">Top-ups</h1>
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
        <div className="overflow-x-auto rounded-md">
          <Table>
            <TableHeader className="px-4">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="font-medium text-muted-foreground">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingSkeleton columns={columns.length} rows={10} />
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="border-b hover:bg-muted/50">
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
                  title="No top-ups"
                  description="There are no top-up requests with the selected filters."
                />
              )}
            </TableBody>
          </Table>

          <div className="py-4 px-4">
            <TablePagination table={table} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
