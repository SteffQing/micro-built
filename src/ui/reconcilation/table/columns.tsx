"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const columns: ColumnDef<RepaymentsResponseDto>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("id")}</span>
    ),
  },
  {
    accessorKey: "loanId",
    header: "Loan ID",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("loanId")}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount Paid",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("amount"))}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("repaidAmount"))}
      </span>
    ),
  },
  {
    accessorKey: "issuedDate",
    header: "Issued Date",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("period")}</span>
    ),
  },
  {
    header: "Action",
    cell: ({ row }) => <Button variant="outline">View</Button>,
  },
];

export default columns;
