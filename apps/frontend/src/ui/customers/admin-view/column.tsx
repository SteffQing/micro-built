"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import { UserAvatar } from "@/components/user-avatar";

const columns: ColumnDef<CustomerListItemDto>[] = [
	{
		id: "select",
		header: "Name",
		cell: ({ row }) => (
			<div className="flex items-center gap-3">
				<UserAvatar
					id={row.original.id}
					name={row.original.name}
					size={32}
				/>
				<span>{row.original.name}</span>
			</div>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		accessorKey: "id",
		header: "Customer ID",
		cell: ({ row }) => <div>{row.getValue("id")}</div>,
	},
	{
		accessorKey: "",
		header: "Contact Info",
		cell: ({ row }) => <div>{row.original.phoneNumber ?? row.original.email}</div>,
	},
	{
		accessorKey: "repaymentRate",
		header: "Repayment Rate",
		cell: ({ row }) => (
			<div className="tabular-nums">{row.getValue("repaymentRate")}%</div>
		),
	},
	{
		accessorKey: "status",
		header: "Account Status",
		cell: ({ row }) => {
			const status = row.getValue("status") as UserStatus;
			return (
				<div
					className={cn(
						"py-1 px-[10px] w-fit rounded-[4px]",
						getUserStatusColor(status),
					)}>
					<p className="text-sm font-normal">{getUserStatusText(status)}</p>
				</div>
			);
		},
	},
	{
		accessorKey: "",
		header: "Action",
		cell: ({ row }) => (
			<Link
				className="text-muted-foreground bg-muted hover:bg-muted/80 font-normal text-xs py-[6px] px-2 rounded-[4px] border border-border"
				href={`/customers/${row.original.id}`}>
				View
			</Link>
		),
	},
];

export default columns;
