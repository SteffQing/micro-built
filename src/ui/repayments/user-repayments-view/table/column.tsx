"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/lib/utils";
import { UserRepaymentModal } from "@/ui/modals/repayments";

const columns: ColumnDef<UserRepaymentHistoryDto>[] = [
  {
    accessorKey: "period",
    header: "Period",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("period")}</span>
    ),
  },
  {
    accessorKey: "expected",
    header: "Amount Expected",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("expected"))}
      </span>
    ),
  },
  {
    accessorKey: "repaid",
    header: "Amount Repaid",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("repaid"))}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("status")}</span>
    ),
  },
  {
    accessorKey: "id",
    header: "View",
    cell: ({ row }) => <UserRepaymentModal id={row.getValue("id")} />,
  },
];

export default columns;
