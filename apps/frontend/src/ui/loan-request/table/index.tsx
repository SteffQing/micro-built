"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoanStatus } from "@/config/enums";
import { userLoans, userMicroLoans } from "@/lib/queries/user/loan";
import { capitalize } from "@/lib/utils";
import { TablePagination } from "@/ui/tables/pagination";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { loanColumns, microLoanColumns } from "./column";

const MICRO_LOAN_STATUSES: MicroLoanStatus[] = ["PENDING", "APPROVED", "DISBURSED", "REJECTED"];

/**
 * The customer's request history in two tabs: Loans (each loan as a whole, LoanStatus) and Micro-loans (each
 * loan's first payout and its top-ups, MicroLoanStatus). Each tab pages on the server and filters by its statuses.
 */
export default function UserLoanRequestHistoryTable() {
  return (
    <Card className="gap-0 bg-background p-0">
      <Tabs defaultValue="loans" className="gap-0">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <h2 className="text-lg font-semibold">Request History</h2>
          <TabsList>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="micro">Micro-loans</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="loans" className="mt-0">
          <LoansTab />
        </TabsContent>
        <TabsContent value="micro" className="mt-0">
          <MicroLoansTab />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function usePaging() {
  return useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
}

function LoansTab() {
  const [status, setStatus] = useState("all");
  const [pagination, setPagination] = usePaging();
  const { data, isLoading } = useQuery(
    userLoans({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(status !== "all" && { status: status as LoanStatus }),
    })
  );
  return (
    <HistoryTable
      columns={loanColumns}
      rows={data?.data ?? []}
      total={data?.meta?.total ?? 0}
      isLoading={isLoading}
      pagination={pagination}
      setPagination={setPagination}
      emptyTitle="No loans yet"
      emptyDescription={status === "all" ? "You haven't requested a loan yet." : "No loans with this status."}
      filter={
        <StatusFilter
          value={status}
          options={Object.values(LoanStatus)}
          onChange={(value) => {
            setStatus(value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        />
      }
    />
  );
}

function MicroLoansTab() {
  const [status, setStatus] = useState("all");
  const [pagination, setPagination] = usePaging();
  const { data, isLoading } = useQuery(
    userMicroLoans({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(status !== "all" && { status: status as MicroLoanStatus }),
    })
  );
  return (
    <HistoryTable
      columns={microLoanColumns}
      rows={data?.data ?? []}
      total={data?.meta?.total ?? 0}
      isLoading={isLoading}
      pagination={pagination}
      setPagination={setPagination}
      emptyTitle="No micro-loans yet"
      emptyDescription={
        status === "all" ? "A loan's payout and its top-ups appear here." : "No micro-loans with this status."
      }
      filter={
        <StatusFilter
          value={status}
          options={MICRO_LOAN_STATUSES}
          onChange={(value) => {
            setStatus(value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        />
      }
    />
  );
}

function StatusFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44" aria-label="Filter by status">
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {capitalize(option.toLowerCase())}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function HistoryTable<T>({
  columns,
  rows,
  total,
  isLoading,
  pagination,
  setPagination,
  emptyTitle,
  emptyDescription,
  filter,
}: {
  columns: ColumnDef<T>[];
  rows: T[];
  total: number;
  isLoading: boolean;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  emptyTitle: string;
  emptyDescription: string;
  filter: React.ReactNode;
}) {
  const table = useReactTable({
    data: rows,
    columns,
    rowCount: total,
    pageCount: Math.ceil(total / pagination.pageSize),
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <section className="px-4 pb-4">
      <div className="mb-3 flex justify-end">{filter}</div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
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
              <TableLoadingSkeleton columns={columns.length} />
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableEmptyState title={emptyTitle} description={emptyDescription} colSpan={columns.length} />
            )}
          </TableBody>
        </Table>
      </div>
      <div className="pt-4">
        <TablePagination table={table} />
      </div>
    </section>
  );
}
