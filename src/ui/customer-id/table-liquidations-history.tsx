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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { TablePagination } from "../tables/pagination";
import { useMutation, useQuery } from "@tanstack/react-query";
import { customerLiquidations } from "@/lib/queries/admin/customer";
import { TableEmptyState } from "../tables/table-empty-state";
import {
	liquidationAcceptance,
	liquidationRejection,
} from "@/lib/mutations/admin/customer";

const columns: ColumnDef<RepaymentsHistoryDto>[] = [
	{
		accessorKey: "id",
		header: "Loan ID",
		cell: ({ row }) => (
			<div className="font-medium text-green-700">{row.getValue("id")}</div>
		),
	},
	{
		accessorKey: "totalAmount",
		header: "Total Amount",
		cell: ({ row }) => (
			<div className="text-muted-foreground">{row.getValue("totalAmount")}</div>
		),
	},
	{
		accessorKey: "penalize",
		header: "Penalty",
		cell: ({ row }) => (
			<div
				className={`${
					row.getValue("penalize") ? "text-red-600" : "text-green-600"
				} font-medium`}>
				{row.getValue("penalize") ? "True" : "False"}
			</div>
		),
	},
	{
		accessorKey: "period",
		id: "status",
		header: "Status",
		cell: ({ row }) => {
			const status = row.getValue("status") as
				| "PENDING"
				| "APPROVED"
				| "REJECTED"
				| "ACCEPTED";
			const loanId = row.getValue("id");
			return (
				<>
					<LiquidationRequestStatus
						liquidationStatus={status}
						id={loanId as string}
					/>
				</>
			);
		},
	},
];

const LiquidationRequestStatus = ({
	liquidationStatus,
	id,
}: {
	liquidationStatus: "PENDING" | "APPROVED" | "REJECTED" | "ACCEPTED";
	id: string;
}) => {
	const { isPending: isAcceptPending, mutateAsync: acceptMutateAsync } =
		useMutation(liquidationAcceptance(id));

	const { isPending: isRejectPending, mutateAsync: rejectMutateAsync } =
		useMutation(liquidationRejection(id));

	const handleAccept = async () => {
		try {
			await acceptMutateAsync();
			// Optionally, show a success toast/notification
			// toast.success("Liquidation request accepted successfully!");
		} catch (error) {
			// Optionally, show an error toast/notification
			// toast.error("Failed to accept liquidation request.");
			console.error("Accept error:", error);
		}
	};

	const handleReject = async () => {
		try {
			await rejectMutateAsync();
			// Optionally, show a success toast/notification
			// toast.success("Liquidation request rejected successfully!");
		} catch (error) {
			// Optionally, show an error toast/notification
			// toast.error("Failed to reject liquidation request.");
			console.error("Reject error:", error);
		}
	};

	console.log({ liquidationStatus });
	if (liquidationStatus === "REJECTED") {
		return (
			<Dialog>
				<DialogTrigger asChild>
					<Button>Rejected, See more</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Are you absolutely sure?</DialogTitle>
						<DialogDescription>
							This action cannot be undone. This will permanently delete your
							account and remove your data from our servers.
						</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>
		);
	}

	if (liquidationStatus === "APPROVED") {
		return <span className="text-green-600 font-medium">Accepted</span>;
	}

	if (liquidationStatus === "PENDING") {
		return (
			<div className="flex items-center gap-1.5">
				<Button
					size="sm"
					className="bg-green-700 hover:bg-green-800 text-white"
					onClick={handleAccept}
					disabled={isAcceptPending || isRejectPending}>
					{isAcceptPending ? "Accepting..." : "Accept"}
				</Button>
				<Button
					size="sm"
					className="bg-destructive text-white"
					onClick={handleReject}
					disabled={isAcceptPending || isRejectPending}>
					{isRejectPending ? "Rejecting..." : "Reject"}
				</Button>
			</div>
		);
	}

	return <></>;
};

export function LiquidationHistoryTable({
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

	console.log({ data: data?.data });

	const table = useReactTable({
		data: data?.data || [],
		columns: columns,
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
						Liquidations Request History
					</CardTitle>
					<Button
						size="sm"
						className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-2">
						<Download className="w-3 h-3" />
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
										title="No Liquidation requests found."
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
