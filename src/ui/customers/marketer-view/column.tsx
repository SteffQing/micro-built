"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import UserAvatarComponent from "../../settings/user-settings-view/user-avatar";

const columns: ColumnDef<CustomerListItemDto>[] = [
	{
		id: "select",
		header: "Customer",
		cell: ({ row }) => (
			<div className="flex items-center gap-3">
				<UserAvatarComponent
					id={row.original.id}
					name={row.original.name}
					className="w-8 h-8"
				/>
				<h4 className="font-medium">{row.original.name}</h4>
			</div>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		accessorKey: "id",
		header: "Customer ID",
		cell: ({ row }) => {
			return (
				<div className="font-medium text-green-600">{row.getValue("id")}</div>
			);
		},
	},
	{
		accessorKey: "",
		header: "Contact Info",
		cell: ({ row }) => (
			<div className="text-muted-foreground">
				{row.original.contact ?? row.original.email}
			</div>
		),
	},
	{
		accessorKey: "repaymentRate",
		header: "Repayment Rate",
		cell: ({ row }) => (
			<div className="flex items-center">
				<span className="font-medium">{row.getValue("repaymentRate")}%</span>
			</div>
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
				className="text-[#666666] font-normal text-xs py-[6px] px-2 rounded-[4px] border border-[#E0E0E0]"
				href={`/customers/${row.original.id}`}>
				View
			</Link>
		),
	},
];

export default columns;
