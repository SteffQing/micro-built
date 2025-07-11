"use client";

import React, { useState } from "react";
import {
  type ColumnDef,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, Download } from "lucide-react";
import { TablePagination } from "../tables/pagination";
import {
  adminCustomerRepaymentHistoryByIdQueryOptions,
  AdminCustomersByIdResponse,
  AdminCustomersRepaymentHistoryByIdResponse,
} from "@/lib/queries/admin-customer-by-id";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";

type RepaymentData = AdminCustomersRepaymentHistoryByIdResponse["data"][0];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Success":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Success
        </Badge>
      );
    case "Pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Pending
        </Badge>
      );
    case "Failed":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Failed
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const columns: ColumnDef<RepaymentData>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "loanId",
    header: "Loan ID",
    cell: ({ row }) => (
      <div className="font-medium text-green-700">{row.getValue("loanId")}</div>
    ),
  },
  {
    accessorKey: "period",
    header: "Month",
    cell: ({ row }) => (
      <div className="text-gray-600">{row.getValue("period")}</div>
    ),
  },
  {
    accessorKey: "repaid",
    header: "Amount Paid",
    cell: ({ row }) => (
      <div className="font-medium">
        {formatCurrency(row.getValue("repaid"))}
      </div>
    ),
  },
  {
    accessorKey: "date",
    header: "Payment Method",
    cell: ({  }) => <div className="text-muted-foreground">Bank Transfer</div>,
  },
  {
    accessorKey: "period",
    id: "status",
    header: "Status",
    cell: ({ row }) => getStatusBadge(row.getValue("period")),
  },
];

type CustomerProfileProps = {
  customer: AdminCustomersByIdResponse["data"];
};

export function RepaymentHistoryTable({ customer }: CustomerProfileProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const { data } = useQuery({
    ...adminCustomerRepaymentHistoryByIdQueryOptions({
      id: customer.id,
      page: 1,
      limit: 5,
      total: 0,
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
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const exportToPDF = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const dataToExport =
      selectedRows.length > 0
        ? selectedRows.map((row) => row.original)
        : data?.data || [];

    // Create export content
    const exportContent = `
REPAYMENT HISTORY REPORT
Customer: ${customer.name}
Generated: ${new Date().toLocaleDateString()}
Records: ${dataToExport.length} ${
      selectedRows.length > 0 ? "(Selected)" : "(All)"
    }

${dataToExport
  .map(
    (item, index) => `
${index + 1}. Loan ID: ${item.loanId}
   Period: ${item.period}
   Amount: ${formatCurrency(item.repaid)}
   Date: ${formatDate(item.date, "PPpp")}
`
  )
  .join("\n")}
    `;

    // Create and download the file
    const blob = new Blob([exportContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customer.name.replace(/\s+/g, "_")}_repayment_history.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Repayment History
          </CardTitle>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search"
              value={
                (table.getColumn("loanId")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("loanId")?.setFilterValue(event.target.value)
              }
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button
            onClick={exportToPDF}
            className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        className="font-medium text-gray-600"
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-b hover:bg-gray-50"
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
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-gray-500"
                  >
                    No repayment history found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="py-4 px-4">
          <TablePagination table={table} />
        </div>
      </CardContent>
    </Card>
  );
}
