"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { userLoanRequestHistoryQueryOptions } from "@/lib/queries/user-loan-request-history";
import { TablePagination } from "../tables/pagination";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: string;
};
const StatusBadge = ({ status }: StatusBadgeProps) => {
  const statusConfig = {
    PENDING: {
      variant: "bg-orange-100 text-orange-800 border-orange-200",
      label: "Pending",
    },
    PREVIEW: {
      variant: "bg-blue-100 text-blue-800 border-blue-200",
      label: "Preview",
    },
    REJECTED: {
      variant: "bg-red-100 text-red-800 border-red-200",
      label: "Rejected",
    },
    ACCEPTED: {
      variant: "bg-green-100 text-green-800 border-green-200",
      label: "Accepted",
    },
    APPROVED: {
      variant: "bg-green-100 text-green-800 border-green-200",
      label: "Approved",
    },
    DISBURSED: {
      variant: "bg-purple-100 text-purple-800 border-purple-200",
      label: "Disbursed",
    },
    REPAID: {
      variant: "bg-emerald-100 text-emerald-800 border-emerald-200",
      label: "Repaid",
    },
  }[status] || {
    variant: "bg-gray-100 text-gray-800 border-gray-200",
    label: status,
  };

  return (
    <Badge className={`${statusConfig.variant} border font-medium px-2 py-1`}>
      {statusConfig.label}
    </Badge>
  );
};

const filterTabs = [
  { key: "all", label: "All Loans" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DISBURSED", label: "Disbursed" },
];

type LoanRequest = {
  id: string;
  amount: number;
  category: string;
  status: string;
  date: string;
};

export const columns: ColumnDef<LoanRequest>[] = [
  {
    id: "date",
    header: "Date",
    accessorKey: "date",
    cell: ({ row }) => (
      <div className="font-medium">{format(row.getValue("date"), "PPpp")}</div>
    ),
  },
  {
    accessorKey: "loanType",
    header: "Loan Type",
    cell: ({ row }) => {
      const loanType = String(row.getValue("loanType"))
        .toLowerCase()
        .replace(/_/g, " ");
      return <div className="capitalize">{loanType}</div>;
    },
  },
  {
    accessorKey: "id",
    header: "Request Id",
    cell: ({ row }) => {
      const requestId = String(row.getValue("id"));
      return <div className="font-medium">{requestId}</div>;
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
      }).format(amount);
      return <div className="capitalize">{formatted}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={String(row.getValue("status"))} />,
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({}) => (
      <div className="text-muted-foreground">
        <Button variant="outline">View</Button>
      </div>
    ),
  },
];

export default function UserLoanRequestHistoryTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const currentPage = 1;

  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isLoading, isError } = useQuery({
    ...userLoanRequestHistoryQueryOptions({
      page: currentPage,
      limit: 10,
    }),
  });

  console.log({ data });

  const handleFilterChange = useCallback((filter: string) => {
    setActiveFilter(filter);
  }, []);

  const filteredData = useMemo(() => {
    const _data = (data && data.data.loans) || [];
    // if (!data?.data) return [];

    if (!Array.isArray(_data)) {
      console.log("Data is not an array:", _data);
      return [];
    }

    return _data.filter((loan) => {
      if (!globalFilter) return true;

      const searchLower = globalFilter.toLowerCase();
      return (
        loan.id.toLowerCase().includes(searchLower) ||
        loan.amount.toString().includes(searchLower) ||
        loan.category.toLowerCase().includes(searchLower) ||
        loan.status.toLowerCase().includes(searchLower)
      );
    });
  }, [data, globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <Card className="space-y-4 bg-background p-4">
      <div className=" w-full">
        <h2 className="text-lg font-semibold py-3">Loan Request History</h2>
        <Separator />
        <div className="flex items-center gap-2 w-full py-3">
          <Input
            type="search"
            className="lg:w-2/7"
            placeholder="Search loan requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex items-center gap-2 lg:w-5/7 flex-1">
            {filterTabs.map((tab) => (
              <Button
                key={tab.key}
                variant={activeFilter === tab.key ? "secondary" : "outline"}
                size="sm"
                onClick={() => handleFilterChange(tab.key)}
                className={cn("", activeFilter === tab.key ? "" : "")}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      {isError ? (
        <div className="rounded-md border p-4">
          <div className="flex h-96 flex-col items-center justify-center gap-4">
            <div className="text-muted-foreground">
              Failed to load loan history. Please try again later.
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
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
                  <TableLoadingSkeleton />
                ) : !isLoading && table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="hover:bg-muted/50"
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
                  <TableEmptyState
                    title="No loan requests history found"
                    description={
                      globalFilter
                        ? "No matching loans found. Try adjusting your search."
                        : "You haven't made any loan requests yet."
                    }
                  />
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <TablePagination table={table} />
          </div>
        </>
      )}
    </Card>
  );
}
