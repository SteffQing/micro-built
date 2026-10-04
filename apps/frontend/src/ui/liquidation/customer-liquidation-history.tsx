"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { type ColumnDef } from "@tanstack/react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TablePagination } from "@/ui/tables/pagination";
import { userLiquidations, userLiquidationProof } from "@/lib/queries/user/liquidation";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

const badgeStyles = {
  AWAITING: "bg-warning/10 text-warning",
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
} as const;

const stateLabels = {
  AWAITING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

function ViewProofButton({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function handleViewProof() {
    setLoading(true);
    try {
      const opts = userLiquidationProof(id);
      const result = await queryClient.fetchQuery(opts);
      if (result?.data?.url) {
        window.open(result.data.url, "_blank");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleViewProof}
      loading={loading}
      className="h-auto py-1 px-2 text-xs"
    >
      <Icon icon={icons.download} size={14} className="mr-1" />
      View
    </Button>
  );
}

const columns: ColumnDef<UserLiquidationDto>[] = [
  {
    accessorKey: "requestedAt",
    header: "Requested Date",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {format(new Date(row.original.requestedAt), "d MMM yyyy")}
      </span>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.original.amount)}
      </span>
    ),
  },
  {
    accessorKey: "state",
    header: "Status",
    cell: ({ row }) => {
      const state = row.original.state;
      return (
        <Badge
          variant="secondary"
          className={badgeStyles[state] ?? "bg-muted text-muted-foreground"}
        >
          {stateLabels[state] ?? state}
        </Badge>
      );
    },
  },
  {
    id: "proof",
    header: "Proof",
    cell: ({ row }) =>
      row.original.hasProof ? (
        <ViewProofButton id={row.original.id} />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "note",
    header: "Admin Note",
    cell: ({ row }) => {
      const note = row.original.note;
      if (!note) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <span className="text-xs text-foreground max-w-[200px] truncate block">
          {note}
        </span>
      );
    },
  },
];

export function CustomerLiquidationHistory() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isLoading } = useQuery(
    userLiquidations({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
    })
  );

  const table = useReactTable({
    data: data?.data || [],
    columns,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      pagination,
    },
    manualPagination: true,
    pageCount: data
      ? Math.ceil(data?.meta!.total / data?.meta!.limit)
      : 0,
  });

  return (
    <Card className="bg-background w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">
          Liquidation History
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-muted-foreground font-medium"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingSkeleton columns={5} />
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableEmptyState
                title="No liquidation requests"
                description="Your liquidation history will appear here once you submit a request."
                colSpan={5}
              />
            )}
          </TableBody>
        </Table>
        <div className="py-4 px-4">
          <TablePagination table={table} />
        </div>
      </CardContent>
    </Card>
  );
}
