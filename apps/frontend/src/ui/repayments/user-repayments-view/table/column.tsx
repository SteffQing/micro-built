"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { formatCurrency, capitalize, cn } from "@/lib/utils";
import { UserRepaymentModal } from "@/ui/modals/repayments";
import { Badge } from "@/components/ui/badge";
import { periodLabel, parseYm } from "@microbuilt/shared";

const deductionStatusColors: Record<DeductionStatus, string> = {
  EXPECTED: "bg-warning/10 text-warning border-warning/20",
  PAID: "bg-success/10 text-success border-success/20",
  PARTIAL: "bg-brand/10 text-brand border-brand/20",
  FAILED: "bg-destructive/10 text-destructive border-destructive/20",
};

const columns: ColumnDef<UserRepaymentHistoryDto>[] = [
  {
    accessorKey: "period",
    header: "Period",
    cell: ({ row }) => {
      const period = row.getValue("period") as string;
      try {
        return <span className="text-muted-foreground">{periodLabel(parseYm(period))}</span>;
      } catch {
        return <span className="text-muted-foreground">{period}</span>;
      }
    },
  },
  {
    accessorKey: "expected",
    header: "Expected",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {formatCurrency(row.getValue("expected"))}
      </span>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {formatCurrency(row.getValue("amount"))}
      </span>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {capitalize((row.getValue("source") as string).toLowerCase())}
      </span>
    ),
  },
  {
    accessorKey: "deductionStatus",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.deductionStatus;
      if (!status) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <Badge
          variant="outline"
          className={cn("text-xs font-medium", deductionStatusColors[status] ?? "")}
        >
          {capitalize(status.toLowerCase())}
        </Badge>
      );
    },
  },
  {
    accessorKey: "id",
    header: "View",
    cell: ({ row }) => <UserRepaymentModal id={row.getValue("id")} />,
  },
];

export default columns;
