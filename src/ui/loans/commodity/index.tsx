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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { TableLoadingSkeleton } from "../../tables/table-skeleton-loader";
import { TableEmptyState } from "../../tables/table-empty-state";
import columns from "./columns";
import { TablePagination } from "@/ui/tables/pagination";
import { allCommodityLoans } from "@/lib/queries/admin/commodity-loans";
import { useDebounce } from "@/hooks/use-debounce";

export default function CommodityLoansTable() {
  const [page] = useState(1);
  const [limit] = useState(20);
  const [status, setStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setStatus("all");
    setSearchTerm("");
  });
  const debouncedSearchTerm = useDebounce(searchTerm, 2000);

  const { data, isLoading } = useQuery({
    ...allCommodityLoans({
      page,
      limit,
      inReview: status === "all" ? undefined : status === "true",
      search: debouncedSearchTerm || undefined,
    }),
  });

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // getRowSelectionModel: getRowSelectionModel(),
    // onRowSelectionChange: setRowSelection,
    // state: {
    //   rowSelection,
    // },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <Card className="bg-background p-5">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          Commodity Loan Applications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Loans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Loans</SelectItem>
              <SelectItem value={"true"}>In Review</SelectItem>
              <SelectItem value={"false"}>Accepted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
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
                  description="There are currently no commodity loans with the selected loan status: set to all to view all commodity loans on the app"
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
