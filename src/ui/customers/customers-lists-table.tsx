"use client";

import { useState } from "react";
import { Search, Badge } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";

import { TablePagination } from "../tables/pagination";
import { Checkbox } from "@/components/ui/checkbox";

import { useQuery } from "@tanstack/react-query";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { customersList } from "@/lib/queries/admin/customers";
import { AVATAR_HOST } from "@/config/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getUserStatusColor, getUserStatusText } from "@/config/status";

// format(date, "d, MMM yyyy")     // "13, Feb 2025"
// format(date, "PP")              // "Feb 13, 2025"
// format(date, "PPpp")            // "Feb 13, 2025 at 2:30 PM"
// format(date, "yyyy-MM-dd")      // "2025-02-13"
// format(date, "MMM d")           // "Feb 13"

export const columns: ColumnDef<CustomerListItemDto>[] = [
  {
    id: "select",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
        <Avatar className="h-8 w-8">
          <AvatarImage
            src={AVATAR_HOST + row.original.id}
            alt={row.original.name}
          />
          <AvatarFallback>
            {row.original.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h4 className="font-medium">{row.original.name}</h4>
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "Customer ID",
    cell: ({ row }) => {
      return (
        <div className="font-medium text-green-600">{row.getValue("id")}</div>
      );
    },
  },
  {
    accessorKey: "",
    header: "Contact Info",
    cell: ({ row }) => (
      <div className="text-muted-foreground">
        {row.original.contact ?? row.original.email}
      </div>
    ),
  },
  {
    accessorKey: "repaymentRate",
    header: "Repayment Rate",
    cell: ({ row }) => (
      <div className="flex items-center">
        <span className="font-medium">{row.getValue("repaymentRate")}%</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Account Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as UserStatus;
      return (
        <div
          className={cn(
            "py-1 px-[10px] w-fit rounded-[4px]",
            getUserStatusColor(status)
          )}
        >
          <p className="text-sm font-normal">{getUserStatusText(status)}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "",
    header: "Action",
    cell: ({ row }) => (
      <Link
        className="text-[#666666] font-normal text-xs py-[6px] px-2 rounded-[4px] border border-[#E0E0E0]"
        href={`/customers/${row.original.id}`}
      >
        View
      </Link>
    ),
  },
];

export default function CustomersListTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearchTerm = useDebounce(searchTerm, 2000);

  const { data, isLoading } = useQuery({
    ...customersList({
      page: currentPage,
      limit: 20,
      search: debouncedSearchTerm || undefined,
      status: statusFilter !== "all" ? (statusFilter as UserStatus) : undefined,
    }),
  });

  const table = useReactTable({
    data: data?.data || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const handleRowClick = (activity: string) => {
    console.log(activity);
    // window.location.href = `/dashboard/activities/${activity}`;
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when search changes
  };

  return (
    <div className="bg-background rounded-xl">
      <h1 className="py-4 px-4">Customer List</h1>
      <Separator />
      <div className="py-4 px-4 flex items-center justify-between w-full">
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, email or contact number"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={handleStatusFilterChange}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="FLAGGED">Flagged</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
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
            <TableLoadingSkeleton columns={5} rows={10} />
          ) : !isLoading && table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => handleRowClick(row.getValue("id"))}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableEmptyState />
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="py-4 px-4">
        <TablePagination table={table} />
      </div>
    </div>
  );
}
