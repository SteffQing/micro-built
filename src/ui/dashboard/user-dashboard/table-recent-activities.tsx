"use client";

import { useState } from "react";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
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

import { TablePagination } from "../../tables/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@radix-ui/react-dialog";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import {
  userRecentActivitiesQuery,
  UserRecentActivity,
} from "@/lib/queries/user-recent-activities";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { format } from "date-fns";

// format(date, "d, MMM yyyy")     // "13, Feb 2025"
// format(date, "PP")              // "Feb 13, 2025"
// format(date, "PPpp")            // "Feb 13, 2025 at 2:30 PM"
// format(date, "yyyy-MM-dd")      // "2025-02-13"
// format(date, "MMM d")           // "Feb 13"

export const columns: ColumnDef<UserRecentActivity>[] = [
  {
    id: "select",
    header: ({}) => <p>Date</p>,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
        <p>{row.original.date}</p>
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue("title")}</div>;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <div className="text-green-700 font-medium">
        {row.getValue("description")}
      </div>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => {
      const activity = row.original;

      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-transparent"
            >
              View
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Activity Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Title
                </label>
                <p className="text-sm">{activity.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Description
                </label>
                <p className="text-sm">{activity.description}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Date
                </label>
                <p className="text-sm">
                  {format(new Date(activity.date), "PPpp")}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Source
                </label>
                <p className="text-sm">{activity.source}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    },
  },
];

export default function UserRecentActivityTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const { data, isLoading, isError, error } = useQuery({
    ...userRecentActivitiesQuery,
  });

  console.log({ data, isLoading, isError, error });

  const table = useReactTable({
    data: data || [],
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

  return (
    <div className="bg-background rounded-xl">
      <h1 className="py-4 px-4">Activity Summary</h1>
      <Separator />
      <div className="py-4 px-4 flex items-center justify-between w-full">
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search customers..."
              value={
                (table.getColumn("description")?.getFilterValue() as string) ??
                ""
              }
              onChange={(event) =>
                table
                  .getColumn("description")
                  ?.setFilterValue(event.target.value)
              }
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
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
            <TableLoadingSkeleton />
          ) : !isLoading && table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => handleRowClick(row.original.title)}
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
