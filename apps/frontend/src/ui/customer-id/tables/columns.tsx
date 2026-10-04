import {
  getLiquidationStatusBadge,
  getPaymentInflowStateBadge,
} from "@/config/status";
import { cn, formatCurrency } from "@/lib/utils";
import AdminLiquidationAction from "@/ui/liquidation/admin-liquidation-action";
import AdminLiquidationProof from "@/ui/liquidation/admin-liquidation-proof";
import { ColumnDef } from "@tanstack/react-table";

/** Runtime shape of a liquidation request row (API returns `status`, not `state`). */
type LiquidationRow = CustomerLiquidationsRequestDto & {
  status: LiquidationStatus;
};

function StatusBadge({
  label,
  className,
  align = "left",
}: {
  label: string;
  className: string;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("flex", align === "right" && "justify-end")}>
      <span
        className={cn(
          "w-fit rounded-[4px] px-2.5 py-1 text-xs font-medium",
          className
        )}
      >
        {label}
      </span>
    </div>
  );
}

const repaymentColumn: ColumnDef<RepaymentsHistoryDto>[] = [
  {
    accessorKey: "id",
    header: "Payment ID",
    cell: ({ row }) => <div>{row.getValue("id")}</div>,
  },
  {
    accessorKey: "period",
    header: "Month",
    cell: ({ row }) => <div>{row.getValue("period")}</div>,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <div className="tabular-nums">
        {formatCurrency(row.getValue("amount"))}
      </div>
    ),
  },
  {
    accessorKey: "applied",
    header: "Applied",
    cell: ({ row }) => (
      <div className="tabular-nums">
        {formatCurrency(row.getValue("applied"))}
      </div>
    ),
  },
  {
    accessorKey: "state",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        align="right"
        {...getPaymentInflowStateBadge(row.getValue("state") as PaymentInflowState)}
      />
    ),
  },
];

const liquidationRequestColumn = (
  customerId: string,
): ColumnDef<LiquidationRow>[] => [
  {
    accessorKey: "id",
    header: "Request ID",
    cell: ({ row }) => <div>{row.getValue("id")}</div>,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <div className="tabular-nums">
        {formatCurrency(row.getValue("amount"))}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        {...getLiquidationStatusBadge(row.getValue("status") as LiquidationStatus)}
      />
    ),
  },
  {
    id: "proof",
    header: "Proof",
    cell: ({ row }) => {
      const { hasProof, id: requestId } = row.original;
      if (!hasProof) return <div className="text-muted-foreground">—</div>;
      return (
        <AdminLiquidationProof customerId={customerId} requestId={requestId} />
      );
    },
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => {
      const { id: requestId, amount, status, hasProof } = row.original;
      return (
        <div className="flex justify-end">
          <AdminLiquidationAction
            id={requestId}
            customerId={customerId}
            amount={amount}
            status={status}
            hasProof={hasProof}
          />
        </div>
      );
    },
  },
];

export { repaymentColumn, liquidationRequestColumn };
