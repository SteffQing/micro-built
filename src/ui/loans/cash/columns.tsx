"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { AVATAR_HOST } from "@/config/constants";
import { getLoanStatusColor } from "@/config/status";
import { AdminLoanViewDialog } from "../admin-loan-view-dialog";

const columns: ColumnDef<CashLoanItemDto>[] = [
  {
    accessorKey: "customerId",
    header: "Customer ID",
    cell: ({ row }) => {
      const id = row.getValue("customerId") as string;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={AVATAR_HOST + id} alt={id} />
            <AvatarFallback>{id}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{id}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "id",
    header: "Loan ID",
    cell: ({ row }) => (
      <span className="text-green-600 font-medium">{row.getValue("id")}</span>
    ),
  },
  {
    accessorKey: "category",
    header: "Loan Type",
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.getValue("category")}
      </Badge>
    ),
  },
  {
    accessorKey: "amount",
    header: "Loan Amount",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("amount"))}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: "Request Date",
    cell: ({ row }) => formatDate(row.getValue("date"), "PPP"),
  },
  {
    accessorKey: "loanTenure",
    header: "Tenure",
    cell: ({ row }) => `${row.getValue("loanTenure")} months`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={getLoanStatusColor(row.getValue("status") as LoanStatus)}
      >
        {row.getValue("status")}
      </Badge>
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => <AdminLoanViewDialog loan={row.original} />,
  },
];

export default columns;
