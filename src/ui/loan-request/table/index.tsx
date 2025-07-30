"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { TablePagination } from "../../tables/pagination";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { Card } from "@/components/ui/card";
import { capitalize } from "@/lib/utils";
import { allCashLoans } from "@/lib/queries/user/loan";
import columns from "./column";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoanStatus } from "@/config/enums";

export default function UserLoanRequestHistoryTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const currentPage = 1;

  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isLoading, isError } = useQuery(
    allCashLoans({
      page: currentPage,
      limit: 10,
      status: activeFilter === "all" ? undefined : (activeFilter as LoanStatus),
    })
  );

  const filteredData = useMemo(() => {
    const _data = (data && data.data) || [];

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
    <Card className="bg-background overflow-x-auto gap-0">
      <div className=" w-full">
        <h2 className="text-lg font-semibold p-4 pt-0">Loan Request History</h2>
        <Separator />
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 max-w-full p-4">
          <Input
            type="search"
            className="w-full"
            placeholder="Search loan requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select onValueChange={(value) => setActiveFilter(value)} defaultValue={activeFilter}>
            <SelectTrigger className="w-fit">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {Object.values(LoanStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {capitalize(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isError ? (
        <div className="rounded-md border p-4">
          <div className="flex h-96 flex-col items-center justify-center gap-4">
            <div className="text-muted-foreground">Failed to load loan history. Please try again later.</div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <section className="pt-0 p-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="hover:bg-muted/50">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
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
                    colSpan={6}
                  />
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <TablePagination table={table} />
          </div>
        </section>
      )}
    </Card>
  );
}
