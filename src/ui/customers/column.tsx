"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { AVATAR_HOST } from "@/config/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getUserStatusColor, getUserStatusText } from "@/config/status";

const columns: ColumnDef<CustomerListItemDto>[] = [
	{
		id: "select",
		header: "Customer",
		cell: ({ row }) => (
			<div className="flex items-center gap-3">
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Select row"
					onClick={(e) => e.stopPropagation()}
				/>
				<Avatar className="h-8 w-8">
					<AvatarImage
						src={AVATAR_HOST + row.original.id}
						alt={row.original.name}
					/>
					<AvatarFallback>
						{row.original.name
							.split(" ")
							.map((n) => n[0])
							.join("")
							.toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<h4 className="font-medium text-sm">{row.original.name}</h4>
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
				<div className="font-medium text-green-600 text-sm">
					{row.getValue("id")}
				</div>
			);
		},
	},
	{
		accessorKey: "",
		header: "Contact Info",
		cell: ({ row }) => (
			<div className="text-muted-foreground text-sm">
				{row.original.contact ?? row.original.email}
			</div>
		),
	},
	{
		accessorKey: "repaymentRate",
		header: "Repayment Rate",
		cell: ({ row }) => (
			<div className="flex items-center text-sm">
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
					<p className="font-normal text-sm">{getUserStatusText(status)}</p>
				</div>
			);
		},
	},
	{
		accessorKey: "",
		header: "Action",
		cell: ({ row }) => (
			<Link
				className="text-muted-foreground font-normal text-xs py-[6px] px-2 rounded-[4px] border "
				href={`/customers/${row.original.id}`}>
				View
			</Link>
		),
	},
];

export default columns;
