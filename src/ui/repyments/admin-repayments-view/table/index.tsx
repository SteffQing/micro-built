"use client";

import { useState } from "react";
import {
	useReactTable,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	flexRender,
	type SortingState,
	type ColumnFiltersState,
} from "@tanstack/react-table";
import { Search } from "lucide-react";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import columns from "./columns";
import { allRepayments } from "@/lib/queries/admin/repayment";
import { RepaymentStatus } from "@/config/enums";
import { TablePagination } from "@/ui/tables/pagination";

export default function RepaymentsTable() {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [pagination, setPagination] = useState({
		pageIndex: 0,
		pageSize: 10,
	});

	const { data, isLoading } = useQuery(
		allRepayments({
			page: pagination.pageIndex + 1,
			limit: pagination.pageSize,
			status:
				statusFilter === "all" ? undefined : (statusFilter as RepaymentStatus),
		}),
	);

	console.log({ data });

	const table = useReactTable({
		data: data?.data || [],
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		rowCount: data?.meta?.total,
		state: {
			sorting,
			columnFilters,
			globalFilter,
			pagination,
		},
		manualPagination: true,
		// pageCount: data ? Math.ceil(data.meta.total / data?.meta.limit) : 0,
	});

	return (
		<div className="bg-background rounded border gap-0">
			<div className="p-3 lg:p-5">
				<h3 className="text-muted-foreground text-base font-medium">
					Repayments
				</h3>
			</div>
			<Separator />
			<div className="flex items-center justify-between gap-4 p-3 lg:p-5">
				<div className="flex items-center gap-4">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search"
							value={globalFilter ?? ""}
							onChange={(event) => setGlobalFilter(String(event.target.value))}
							className="pl-9 w-64"
						/>
					</div>
				</div>

				<Select
					value={statusFilter}
					onValueChange={(value) => setStatusFilter(value)}>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Filter" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All</SelectItem>
						{Object.values(RepaymentStatus).map((status, i) => (
							<SelectItem key={i} value={status}>
								{status}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Separator />

			<div className="p-3 lg:p-5 pt-0">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className="text-muted-foreground font-medium">
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
							<TableLoadingSkeleton columns={7} />
						) : table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}>
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
								colSpan={7}
								title="No recent repayments"
								description={`There are no repayments with the status "${statusFilter}" at the moment. Try selecting a different status or check back later.`}
							/>
						)}
					</TableBody>

					<div className="w-full flex items-center justify-center">
						<TablePagination table={table} />
					</div>
				</Table>
			</div>
		</div>
	);
}
