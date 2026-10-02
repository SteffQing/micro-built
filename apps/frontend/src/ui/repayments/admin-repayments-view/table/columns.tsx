"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { AdminRepaymentModal } from "@/ui/modals/repayments";
import { Badge } from "@/components/ui/badge";
import { cn, capitalize } from "@/lib/utils";

const stateColors: Record<PaymentInflowState, string> = {
  AWAITING: "bg-warning/10 text-warning border-warning/20",
  SETTLED: "bg-success/10 text-success border-success/20",
  REVIEWING: "bg-brand/10 text-brand border-brand/20",
  UNMATCHED: "bg-destructive/10 text-destructive border-destructive/20",
  REJECTED: "bg-muted text-muted-foreground border-border",
};

const columns: ColumnDef<RepaymentsHistoryDto>[] = [
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => {
      const { customer } = row.original;
      return (
        <div className="flex items-center gap-3">
          <UserAvatar
            id={customer?.id ?? ""}
            name={customer?.name}
            size={32}
          />
          <span className="font-medium">{customer?.name ?? "Unlinked"}</span>
        </div>
      );
    },
  },
  {
    id: "externalId",
    header: "IPPIS ID",
    cell: ({ row }) => (
      <span className="text-muted-foreground font-medium">
        {row.original.customer?.externalId ?? row.original.externalUserId ?? "—"}
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
    accessorKey: "applied",
    header: "Applied",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {formatCurrency(row.getValue("applied"))}
      </span>
    ),
  },
  {
    accessorKey: "period",
    header: "Period",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("period")}</span>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {capitalize((row.getValue("source") as string).toLowerCase())}
      </span>
    ),
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => {
      const state = row.original.state;
      return (
        <Badge
          variant="outline"
          className={cn("text-xs font-medium", stateColors[state] ?? "")}
        >
          {capitalize(state.replace(/_/g, " ").toLowerCase())}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—"}
      </span>
    ),
  },
  {
    accessorKey: "id",
    header: "View",
    cell: ({ row }) => <AdminRepaymentModal id={row.getValue("id")} />,
  },
];

export default columns;
