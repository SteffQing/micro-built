"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export type Customer = {
  id: string
  name: string
  avatar: string
  contactInfo: string
  outstanding: string
  repaymentStatus: string
  accountStatus: "Active" | "Suspended" | "Inactive"
}


const getStatusBadge = (status: string) => {
  switch (status) {
    case "Active":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Active
        </Badge>
      );
    case "Suspended":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Suspended
        </Badge>
      );
    case "Inactive":
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
          Inactive
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export const columns: ColumnDef<Customer>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const customer = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage
              src={customer.avatar || "/placeholder.svg"}
              alt={customer.name}
            />
            <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
              {customer.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-gray-900">{customer.name}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "id",
    header: "Customer ID",
    cell: ({ row }) => (
      <div className="text-green-700 font-medium">{row.getValue("id")}</div>
    ),
  },
  {
    accessorKey: "contactInfo",
    header: "Contact Info",
    cell: ({ row }) => (
      <div className="text-gray-600">{row.getValue("contactInfo")}</div>
    ),
  },
  {
    accessorKey: "outstanding",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-medium text-gray-600"
        >
          Outstanding
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="text-gray-900 font-medium">
        {row.getValue("outstanding")}
      </div>
    ),
  },
  {
    accessorKey: "repaymentStatus",
    header: "Repayment Status",
    cell: ({ row }) => (
      <div className="text-gray-600">{row.getValue("repaymentStatus")}</div>
    ),
  },
  {
    accessorKey: "accountStatus",
    header: "Account Status",
    cell: ({ row }) => getStatusBadge(row.getValue("accountStatus")),
  },
  {
    id: "actions",
    header: "Action",
    enableHiding: false,
    cell: ({ row }) => {
      const customer = row.original;

      return (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-green-700 hover:bg-green-50"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `/admin/customers/${customer.id}`;
            }}
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(customer.id)}
              >
                Copy customer ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  (window.location.href = `/admin/customers/${customer.id}`)
                }
              >
                View customer details
              </DropdownMenuItem>
              <DropdownMenuItem>Edit customer</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                Delete customer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
