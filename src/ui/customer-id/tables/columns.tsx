import {
  getLiquidationStatusBadge,
  getRepaymentStatusBadge,
} from "@/config/status";
import { cn, formatCurrency } from "@/lib/utils";
import HandleLiquidation from "@/ui/modals/customer-actions/handle-liquidation";
import { ColumnDef } from "@tanstack/react-table";

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
    accessorKey: "loanId",
    header: "Loan ID",
    cell: ({ row }) => <div>{row.getValue("loanId") ?? "—"}</div>,
  },
  {
    accessorKey: "period",
    header: "Month",
    cell: ({ row }) => <div>{row.getValue("period")}</div>,
  },
  {
    accessorKey: "repaidAmount",
    header: "Amount Paid",
    cell: ({ row }) => (
      <div className="tabular-nums">
        {formatCurrency(row.getValue("repaidAmount"))}
      </div>
    ),
  },
  {
    accessorKey: "expectedAmount",
    header: "Amount Expected",
    cell: ({ row }) => (
      <div className="tabular-nums">
        {formatCurrency(row.getValue("expectedAmount"))}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        align="right"
        {...getRepaymentStatusBadge(row.getValue("status") as RepaymentStatus)}
      />
    ),
  },
];

const liquidationRequestColumn: ColumnDef<CustomerLiquidationsRequestDto>[] = [
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
        {...getLiquidationStatusBadge(
          row.getValue("status") as LiquidationStatus
        )}
      />
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <HandleLiquidation {...row.original} />
      </div>
    ),
  },
];

export { repaymentColumn, liquidationRequestColumn };
