import {
  getLoanStatusColor,
  getUserStatusColor,
  getUserStatusText,
} from "@/config/status";
import { cn, formatCurrency } from "@/lib/utils";
import HandleLiquidation from "@/ui/modals/customer-actions/handle-liquidation";
import { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "date-fns";

const repaymentColumn: ColumnDef<RepaymentsHistoryDto>[] = [
  {
    accessorKey: "loanId",
    header: "Loan ID",
    cell: ({ row }) => (
      <div className="font-medium text-green-700">{row.getValue("loanId")}</div>
    ),
  },
  {
    accessorKey: "period",
    header: "Month",
    cell: ({ row }) => (
      <div className="text-gray-600">{row.getValue("period")}</div>
    ),
  },
  {
    accessorKey: "repaid",
    header: "Amount Paid",
    cell: ({ row }) => (
      <div className="font-medium">
        {formatCurrency(row.getValue("repaid"))}
      </div>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <div className="text-muted-foreground">
        {formatDate(row.getValue("date"), "PPP")}
      </div>
    ),
  },
  {
    accessorKey: "period",
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as UserStatus;
      return (
        <div
          className={cn(
            "py-1 px-[10px] w-fit rounded-[4px]",
            getUserStatusColor(status)
          )}
        >
          <p className="text-sm font-normal">{getUserStatusText(status)}</p>
        </div>
      );
    },
  },
];

const liquidationRequestColumn: ColumnDef<CustomerLiquidationsRequestDto>[] = [
  {
    accessorKey: "id",
    header: "Request ID",
    cell: ({ row }) => (
      <div className="font-medium text-green-700">{row.getValue("id")}</div>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <div className="text-muted-foreground">
        {formatCurrency(row.getValue("amount"))}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as LiquidationStatus;
      return (
        <div
          className={cn(
            "py-1 px-[10px] w-fit rounded-[4px]",
            getLoanStatusColor(status)
          )}
        >
          <p className="text-sm font-normal">{status}</p>
        </div>
      );
    },
  },
  {
    header: "Action",
    cell: ({ row }) => <HandleLiquidation {...row.original} />,
  },
];

export { repaymentColumn, liquidationRequestColumn };
