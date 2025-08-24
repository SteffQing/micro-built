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
  PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { TablePagination } from "../tables/pagination";
import { useQuery } from "@tanstack/react-query";
import { cn, formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";
import { customerRepayments } from "@/lib/queries/admin/customer";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import { TableEmptyState } from "../tables/table-empty-state";

const columns: ColumnDef<RepaymentsHistoryDto>[] = [
  {
    accessorKey: "loanId",
    header: "Loan ID",
    cell: ({ row }) => <div className="font-medium text-green-700">{row.getValue("loanId")}</div>,
  },
  {
    accessorKey: "period",
    header: "Month",
    cell: ({ row }) => <div className="text-gray-600">{row.getValue("period")}</div>,
  },
  {
    accessorKey: "repaid",
    header: "Amount Paid",
    cell: ({ row }) => <div className="font-medium">{formatCurrency(row.getValue("repaid"))}</div>,
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => <div className="text-muted-foreground">{formatDate(row.getValue("date"), "PPP")}</div>,
  },
  {
    accessorKey: "period",
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as UserStatus;
      return (
        <div className={cn("py-1 px-[10px] w-fit rounded-[4px]", getUserStatusColor(status))}>
          <p className="text-sm font-normal">{getUserStatusText(status)}</p>
        </div>
      );
    },
  },
];

export function RepaymentHistoryTable({ id }: Pick<CustomerInfoDto, "id" | "name">) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 6,
    });

  const { data } = useQuery(
    customerRepayments(id, {
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      // need repayment status
    })
  );

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

		manualPagination: true,

		onPaginationChange: setPagination,
    
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			pagination,
		},
	});

  return (
		<Card className="bg-background">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg font-semibold">
						Repayment History
					</CardTitle>
					<Button
						size="sm"
						className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-2">
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
												className="font-medium text-gray-600">
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
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
										className="border-b hover:bg-gray-50">
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className="py-4">
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								))
							) : (
								<>
									<TableEmptyState
										title="No repayment history found."
										description=" "
										colSpan={columns.length}
									/>
								</>
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
