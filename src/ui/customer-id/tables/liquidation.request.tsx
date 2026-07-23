"use client";

import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { TablePagination } from "../../tables/pagination";
import { customerLiquidations } from "@/lib/queries/admin/customer";
import { formatCurrency } from "@/lib/utils";
import { liquidationRequestColumn } from "./columns";
import { TableToolbar } from "./toolbar";
import { TableEmpty } from "../empty-state";

const statusOptions = [
  { label: "Pending", value: "PENDING" },
  { label: "Reviewing", value: "REVIEWING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

export default function LiquidationRequestTable({
  id,
}: Pick<CustomerInfoDto, "id" | "name">) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 6,
  });

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [status]);

  const { data } = useQuery(
    customerLiquidations(id, {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(status !== "all" && { status: status as LiquidationStatus }),
    })
  );

  // Status is filtered server-side (keeps pagination counts accurate); search is
  // applied client-side over the loaded page since the endpoint takes no `search`.
  const rows = useMemo(() => {
    const loaded = data?.data ?? [];
    if (!search) return loaded;

    const needle = search.toLowerCase();
    return loaded.filter((row) =>
      [row.id, formatCurrency(row.amount)].some((value) =>
        String(value).toLowerCase().includes(needle)
      )
    );
  }, [data, search]);

  const table = useReactTable({
    data: rows,
    columns: liquidationRequestColumn,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: data?.meta?.total ?? 0,
    pageCount: data?.meta ? Math.ceil(data.meta.total / data.meta.limit) : 0,
    onPaginationChange: setPagination,
    state: { pagination },
  });

  return (
    <Card className="gap-0 overflow-hidden bg-background p-0">
      <div className="px-4 py-4 sm:px-5">
        <h2 className="font-semibold text-foreground">Liquidation Requests</h2>
      </div>
      <Separator className="bg-[#eee]" />

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        statusOptions={statusOptions}
      />

      <Table className="min-w-180 text-sm">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-b border-[#eee] hover:bg-transparent [&>th]:h-12 [&>th]:px-3 [&>th]:text-[13px] [&>th]:font-medium [&>th]:text-[#666] [&>th:first-child]:pl-5 [&>th:last-child]:pr-5 [&>th:last-child]:text-right"
            >
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
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-b border-[#eee] hover:bg-gray-50 [&>td]:px-3 [&>td]:py-3.5 [&>td]:text-[#666] [&>td:first-child]:pl-5 [&>td:last-child]:pr-5"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={liquidationRequestColumn.length}
              title="No Liquidation Requests"
              description={
                search || status !== "all"
                  ? "No requests on this page match your filters."
                  : "No liquidation requests found for this user"
              }
            />
          )}
        </TableBody>
      </Table>

      <div className="px-4 py-4 sm:px-5">
        <TablePagination table={table} />
      </div>
    </Card>
  );
}
