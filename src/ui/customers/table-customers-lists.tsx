"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
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

import { TablePagination } from "../tables/pagination";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { customersList } from "@/lib/queries/admin/customers";
import columns from "./column";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

// format(date, "d, MMM yyyy")     // "13, Feb 2025"
// format(date, "PP")              // "Feb 13, 2025"
// format(date, "PPpp")            // "Feb 13, 2025 at 2:30 PM"
// format(date, "yyyy-MM-dd")      // "2025-02-13"
// format(date, "MMM d")           // "Feb 13"

export default function CustomersListTable() {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = useState({});

	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [currentPage, setCurrentPage] = useState(1);
	const [searchTerm, setSearchTerm] = useState("");

	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 12,
	});

	const debouncedSearchTerm = useDebounce(searchTerm, 2000);

   const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(
		customersList({
			page: pagination.pageIndex + 1,
			limit: pagination.pageSize,
			search: debouncedSearchTerm || undefined,
			status: statusFilter !== "all" ? (statusFilter as UserStatus) : undefined,
		}),
	);

	const table = useReactTable({
		data: data?.data || [],
		columns,

		rowCount: data?.meta?.total || 0,

		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		// getPaginationRowModel: getPaginationRowModel(),

		manualPagination: true,

		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,

        onPaginationChange: setPagination,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			pagination,
		},
	});

    useEffect(() => {
			const currentPage = pagination.pageIndex + 1;
			const totalPages = data?.meta?.total
				? Math.ceil(data.meta.total / pagination.pageSize)
				: 0;
			const hasNextPage = currentPage < totalPages;

			if (hasNextPage && data) {
				const nextPageParams = {
					page: currentPage + 1,
					limit: pagination.pageSize,
					search: debouncedSearchTerm || undefined,
					status:
						statusFilter !== "all" ? (statusFilter as UserStatus) : undefined,
				};

				queryClient.prefetchQuery(customersList(nextPageParams));
			}
		}, [
			pagination.pageIndex,
			pagination.pageSize,
			debouncedSearchTerm,
			statusFilter,
			data,
			queryClient,
		]);

	const handleRowClick = (activity: string) => {
		console.log(activity);
	};

	const handleStatusFilterChange = (value: string) => {
		setStatusFilter(value);
		setCurrentPage(1); // Reset to first page when filter changes
	};

	const handleSearchChange = (value: string) => {
		setSearchTerm(value);
		setCurrentPage(1); // Reset to first page when search changes
	};

	return (
		<Card className="bg-background rounded-xl p-4">
			<h1 className="py-4 px-4">Customer List</h1>
			<Separator />
			<div className="py-4 px-4 flex items-center justify-between w-full">
				<div className="flex gap-4 mt-4">
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
						<Input
							placeholder="Search by name, email or contact number"
							value={searchTerm}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="pl-10"
							disabled={isLoading}
						/>
					</div>
					<Select
						value={statusFilter}
						onValueChange={handleStatusFilterChange}
						disabled={isLoading}>
						<SelectTrigger className="w-[140px]">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="ACTIVE">Active</SelectItem>
							<SelectItem value="INACTIVE">Inactive</SelectItem>
							<SelectItem value="FLAGGED">Flagged</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<Table>
				<TableHeader className="px-4">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="border-b">
							{headerGroup.headers.map((header) => {
								return (
									<TableHead
										key={header.id}
										className="font-medium text-sm">
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
					{isLoading ? (
						<TableLoadingSkeleton columns={6} rows={10} />
					) : !isLoading && table.getRowModel().rows?.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
								className="border-b hover:bg-gray-50 cursor-pointer"
								onClick={() => handleRowClick(row.getValue("id"))}>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id} className="py-4">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))
					) : (
						<TableEmptyState
							colSpan={6}
							title="No customers found"
							description={`No customers found for ${
								statusFilter === "all" ? "all" : statusFilter
							} status`}
						/>
					)}
				</TableBody>
			</Table>

			{/* Pagination */}
			<div className="py-4 px-4">
				<TablePagination table={table} />
			</div>
		</Card>
	);
}
