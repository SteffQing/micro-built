"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon, icons } from "@/components/icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
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

import { TablePagination } from "@/ui/tables/pagination";

import { type UseQueryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountOfficerCustomersList } from "@/lib/queries/admin/account-officer";
import columns from "@/ui/customers/admin-view/column"; // Reusing columns as per instruction "follow its entire table and column design"
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface Props {
  officerId: string;
}

/** An account officer's customers. */
export default function AccountOfficerCustomersTable({ officerId }: Props) {
  const listQuery = useCallback(
    (params: AccountOfficerCustomersQuery) => accountOfficerCustomersList(officerId, params),
    [officerId],
  );
  return (
    <CustomerGroupTable
      title="Managed Customers"
      groupKey={officerId}
      listQuery={listQuery}
      emptyDescription={(status) => `No customers found under this officer with ${status} status`}
    />
  );
}

interface GroupProps {
  title: string;
  /** Changes when the group does (the next page is prefetched per group). */
  groupKey: string;
  listQuery: (
    params: AccountOfficerCustomersQuery,
  ) => UseQueryOptions<
    ApiRes<CustomerListItemDto[]>,
    Error,
    ApiRes<CustomerListItemDto[]>,
    (string | AccountOfficerCustomersQuery)[]
  >;
  emptyDescription: (status: string) => string;
}

/** A paged, searchable table of a group of customers (an account officer's, an organization's). */
export function CustomerGroupTable({ title, groupKey, listQuery, emptyDescription }: GroupProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 12,
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 2000);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    listQuery({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      search: debouncedSearchTerm || undefined,
      status: statusFilter !== "all" ? (statusFilter as UserStatus) : undefined,
    })
  );

  const table = useReactTable({
    data: data?.data || [],
    columns,
    rowCount: data?.meta?.total || 0,
    pageCount: data?.meta ? Math.ceil(data.meta.total / data.meta.limit) : 0,
    manualPagination: true,

    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    onPaginationChange: setPagination,

    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,

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
        search: debouncedSearchTerm || undefined,
        status:
          statusFilter !== "all" ? (statusFilter as UserStatus) : undefined,
      };

      queryClient.prefetchQuery(
        listQuery(nextPageParams)
      );
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    debouncedSearchTerm,
    statusFilter,
    data,
    queryClient,
    groupKey,
    listQuery,
  ]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  return (
    <Card className="bg-background rounded-xl p-4">
      <h1 className="py-4 px-4 font-semibold text-lg">{title}</h1>
      <Separator />
      <div className="flex flex-wrap items-center gap-3 px-4 py-4">
        <div className="relative w-full sm:w-64">
          <Icon
            icon={icons.search}
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search by name, email..."
            aria-label="Search customers"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 w-full pl-10"
            disabled={isLoading}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={handleStatusFilterChange}
          disabled={isLoading}
        >
          <SelectTrigger
            className="data-[size=default]:h-9 w-[150px]"
            aria-label="Filter by status"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="FLAGGED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader className="px-4">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b">
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id} className="font-medium text-sm">
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
                className="border-b hover:bg-muted cursor-pointer"
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
              colSpan={6}
              title="No customers found"
              description={emptyDescription(statusFilter === "all" ? "any" : statusFilter)}
            />
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="py-4 px-4">
        <TablePagination table={table} />
      </div>
    </Card>
  );
}
