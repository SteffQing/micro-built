"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { formatCurrency, formatDate } from "@/lib/utils";

const columns: ColumnDef<UserRepaymentDto>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue("id")}</span>,
  },
  {
    accessorKey: "loanId",
    header: "Loan ID",
    cell: ({ row }) => <span className="font-medium">{row.getValue("loanId")}</span>,
  },
  {
    accessorKey: "repaid",
    header: "Amount Repaid",
    cell: ({ row }) => <span className="font-medium">{formatCurrency(row.getValue("repaid"))}</span>,
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.getValue("date"))}</span>,
  },
  {
    accessorKey: "period",
    header: "Period",
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue("period")}</span>,
  },
];

export default columns;
