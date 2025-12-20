"use client";

import { useEffect, useState } from "react";
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
	getSortedRowModel,
	PaginationState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";

import { TablePagination } from "../../tables/pagination";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";

import { customersList } from "@/lib/queries/admin/customers";
import columns from "./column";
import { Card } from "@/components/ui/card";
import { useFilters } from "@/components/filters/useFilters";
import {
	FilterBuilder,
	FilterConfig,
} from "@/components/filters/FilterBuilder";

// format(date, "d, MMM yyyy")     // "13, Feb 2025"
// format(date, "PP")              // "Feb 13, 2025"
// format(date, "PPpp")            // "Feb 13, 2025 at 2:30 PM"
// format(date, "yyyy-MM-dd")      // "2025-02-13"
// format(date, "MMM d")           // "Feb 13"

const filterConfig: FilterConfig[] = [
	{
		key: "search",
		type: "text",
		label: "Search",
		placeholder: "Search by name, email, contact or IPPIS ID",
		showSearchIcon: true,
	},
	{
		key: "status",
		type: "select",
		label: "Status",
		options: [
			{ label: "All Status", value: "all" },
			{ label: "Active", value: "ACTIVE" },
			{ label: "Inactive", value: "INACTIVE" },
			{ label: "Flagged", value: "FLAGGED" },
		],
	},
	{
		key: "joinDate",
		type: "date",
		label: "Customer Join Time",
		placeholder: "Pick a date range",
	},
	{
		key: "officerId",
		type: "account-officer",
		label: "Account Officer",
		placeholder: "Select Account Officer",
	},
	{
		key: "activeLoansOnly",
		type: "checkbox",
		label: "Active Loans Only",
		description: "Show customers with active loans only",
	},
	{
		key: "dueForLiquidation",
		type: "checkbox",
		label: "Due for Liquidation",
		description: "Show customers due for liquidation",
	},
];

export default function CustomersListTable() {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = useState({});

	const { filters, setFilter, clearFilters, debouncedFilters } = useFilters({
		initialState: {
			search: "",
			status: undefined,
			joinDate: undefined,
			activeLoansOnly: false,
			dueForLiquidation: false,
			officerId: [],
		},
		debounceMs: 500,
	});

	const queryClient = useQueryClient();

	// Create local pagination state that resets when filters change
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 12,
	});

	// Reset pagination when search or status changes
	useEffect(() => {
		setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	}, [debouncedFilters]);

	const { data, isLoading } = useQuery(
		customersList({
			page: pagination.pageIndex + 1,
			limit: pagination.pageSize,
			search: debouncedFilters.search as string,
			status:
				debouncedFilters.status === "all"
					? undefined
					: (debouncedFilters.status as UserStatus),
			// startDate: (debouncedFilters.joinDate as any)?.start?.toISOString(),
			// endDate: (debouncedFilters.joinDate as any)?.end?.toISOString(),
			// activeLoansOnly: debouncedFilters.activeLoansOnly as boolean,
			// dueForLiquidation: debouncedFilters.dueForLiquidation as boolean,
			// officerId: Array.isArray(debouncedFilters.officerId)
			// 	? debouncedFilters.officerId.join(",")
			// 	: (debouncedFilters.officerId as string),
		}),
	);

	const table = useReactTable({
		data: data?.data || [],
		columns,

		rowCount: data?.meta?.total || 0,

		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),

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
				search: debouncedFilters.search as string,
				status:
					debouncedFilters.status === "all"
						? undefined
						: (debouncedFilters.status as UserStatus),
				startDate: (debouncedFilters.joinDate as any)?.start?.toISOString(),
				endDate: (debouncedFilters.joinDate as any)?.end?.toISOString(),
				activeLoansOnly: debouncedFilters.activeLoansOnly as boolean,
				dueForLiquidation: debouncedFilters.dueForLiquidation as boolean,
				officerId: Array.isArray(debouncedFilters.officerId)
					? debouncedFilters.officerId.join(",")
					: (debouncedFilters.officerId as string),
			};

			queryClient.prefetchQuery(customersList(nextPageParams));
		}
	}, [
		pagination.pageIndex,
		pagination.pageSize,
		debouncedFilters,
		data,
		queryClient,
	]);

	return (
		<Card className="bg-background rounded-xl p-4">
			<h1 className="py-4 px-4">Customer List</h1>
			<Separator />
			<div className="py-4 px-4 w-full">
				<FilterBuilder
					config={filterConfig}
					state={filters}
					onChange={setFilter}
					onClear={clearFilters}
					triggerLabel="Filters"
					side="top"
				/>
			</div>

			<Table>
				<TableHeader className="px-4">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="border-b">
							{headerGroup.headers.map((header) => {
								return (
									<TableHead key={header.id} className="font-medium text-sm">
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
								className="border-b hover:bg-gray-50 cursor-pointer">
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
								filters.status ? filters.status : "current filters"
							}`}
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
