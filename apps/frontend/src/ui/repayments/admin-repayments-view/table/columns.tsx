"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { capitalize, formatCurrency, formatPeriodLabel } from "@/lib/utils";
import { getPaymentInflowStateBadge } from "@/config/status";
import { useUserProvider } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Icon, icons } from "@/components/icon";
import { AdminRepaymentModal } from "@/ui/modals/repayments";
import AdminLiquidationAction from "@/ui/liquidation/admin-liquidation-action";
import { StatusPill, customerCell, formatDate } from "../paged-table-card";

/**
 * Payroll rows open the detail / manual-resolution dialog. A liquidation still awaiting a decision
 * opens the accept / reject dialog for super admins (the only role the API lets decide); everyone
 * else gets the read-only detail.
 */
function InflowAction({ row }: { row: RepaymentsHistoryDto }) {
  const { userRole } = useUserProvider();
  if (
    row.source === "LIQUIDATION" &&
    row.state === "AWAITING" &&
    row.customer &&
    userRole === "SUPER_ADMIN"
  ) {
    return (
      <AdminLiquidationAction
        id={row.id}
        customerId={row.customer.id}
        amount={row.amount}
        status="PENDING"
        hasProof={row.hasProof}
        trigger={
          <Button size="sm" className="text-xs">
            <Icon icon={icons.view} size={12} className="mr-1" />
            Review
          </Button>
        }
      />
    );
  }
  return <AdminRepaymentModal id={row.id} />;
}

const columns: ColumnDef<RepaymentsHistoryDto>[] = [
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => {
      const { customer, externalUserId } = row.original;
      return customerCell(customer ?? { name: "Unmatched", externalId: externalUserId });
    },
  },
  {
    accessorKey: "period",
    header: "Period",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">{formatPeriodLabel(row.original.period)}</span>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <StatusPill
        label={capitalize(row.original.source.toLowerCase())}
        className={
          row.original.source === "LIQUIDATION"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }
      />
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatCurrency(row.original.amount)}</span>
    ),
  },
  {
    accessorKey: "applied",
    header: "Applied",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{formatCurrency(row.original.applied)}</span>
    ),
  },
  {
    accessorKey: "state",
    header: "State",
    cell: ({ row }) => <StatusPill {...getPaymentInflowStateBadge(row.original.state)} />,
  },
  {
    accessorKey: "createdAt",
    header: "Received",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: "right" },
    cell: ({ row }) => (
      <div className="flex justify-end">
        <InflowAction row={row.original} />
      </div>
    ),
  },
];

export default columns;
