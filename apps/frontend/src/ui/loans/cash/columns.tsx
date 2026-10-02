"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { getLoanStatusColor } from "@/config/status";
import { CashLoanModal } from "@/ui/modals";
import { UserAvatar } from "@/components/user-avatar";

const columns: ColumnDef<CashLoanItemDto>[] = [
  {
    id: "customer.id",
    header: "Customer",
    cell: ({ row }) => {
      const { id, name } = row.original.customer;
      return (
        <div className="flex items-center gap-3">
          <UserAvatar id={id} name={name} size={32} />
          <span className="font-medium">{name}</span>
        </div>
      );
    },
  },
  {
    id: "IPPIS ID",
    header: "IPPIS ID",
    cell: ({ row }) => <span className="text-success font-medium">{row.original.customer.externalId}</span>,
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
    accessorKey: "principal",
    header: "Loan Amount",
    cell: ({ row }) => <span className="font-medium">{formatCurrency(row.getValue("principal"))}</span>,
  },
  {
    accessorKey: "date",
    header: "Request Date",
    cell: ({ row }) => formatDate(row.getValue("date"), "PPP"),
  },
  {
    accessorKey: "tenure",
    header: "Tenure",
    cell: ({ row }) => `${row.getValue("tenure")} months`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="secondary" style={{ backgroundColor: getLoanStatusColor(row.getValue("status") as LoanStatus) }}>
        {row.getValue("status")}
      </Badge>
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => <CashLoanModal id={row.original.id} />,
  },
];

export default columns;
