"use client";

import React, { useState } from "react";
import {
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { TablePagination } from "../../tables/pagination";
import { useQuery } from "@tanstack/react-query";
import { customerLiquidations } from "@/lib/queries/admin/customer";
import { TableEmptyState } from "../../tables/table-empty-state";
import { liquidationRequestColumn } from "./columns";

export default function LiquidationRequestTable({
	id,
}: Pick<CustomerInfoDto, "id" | "name">) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = React.useState({});
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 6,
	});

	const { data } = useQuery(
		customerLiquidations(id, {
			page: pagination.pageIndex + 1,
			limit: pagination.pageSize,
			// need repayment status
		}),
	);

	const table = useReactTable({
		data: data?.data || [],
		columns: liquidationRequestColumn,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		rowCount: data?.meta?.total,

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
				<CardTitle className="text-lg font-semibold">
					Liquidation Requests
				</CardTitle>
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
										title="No Liquidation requests found."
										description=" "
										colSpan={liquidationRequestColumn.length}
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
