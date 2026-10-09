import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "date-fns";
import { UserCashLoanModal } from "../../modals";
import { UserMicroLoanModal } from "../../modals/user-micro-loan";
import { formatCurrency } from "@/lib/utils";

export const StatusBadge = ({ status }: { status: LoanStatus }) => {
  const statusConfig = {
    PENDING: {
      variant: "bg-warning/10 text-warning border-warning/20",
      label: "Pending",
    },
    PREVIEW: {
      variant: "bg-primary/10 text-primary border-primary/20",
      label: "Preview",
    },
    REJECTED: {
      variant: "bg-destructive/10 text-destructive border-destructive/20",
      label: "Rejected",
    },
    ACCEPTED: {
      variant: "bg-success/10 text-success border-success/20",
      label: "Accepted",
    },
    APPROVED: {
      variant: "bg-success/10 text-success border-success/20",
      label: "Approved",
    },
    DISBURSED: {
      variant: "bg-chart-4/10 text-chart-4 border-chart-4/20",
      label: "Disbursed",
    },
    REPAID: {
      variant: "bg-success/10 text-success border-success/20",
      label: "Repaid",
    },
  }[status] || {
    variant: "bg-muted text-muted-foreground border-border",
    label: status,
  };

  return <Badge className={`${statusConfig.variant} border font-medium px-2 py-1`}>{statusConfig.label}</Badge>;
};

const label = (value: string) => value.toLowerCase().replace(/_/g, " ");

/** Loans: one row per loan, priced and decided as a whole. */
export const loanColumns: ColumnDef<UserCashLoan>[] = [
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => <div className="font-medium">{formatDate(row.original.createdAt, "PPP")}</div>,
  },
  {
    id: "type",
    header: "Loan Type",
    cell: ({ row }) => (
      <div className="capitalize">
        {row.original.assetName ? `${label(row.original.category)} · ${row.original.assetName}` : label(row.original.category)}
      </div>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    // An asset loan has no amount until it is priced on approval.
    cell: ({ row }) => <div>{row.original.principal > 0 ? formatCurrency(row.original.principal) : "—"}</div>,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => <UserCashLoanModal id={row.original.id} />,
  },
];

/** Micro-loans: each loan's first payout and its top-ups, each with its own status. */
export const microLoanColumns: ColumnDef<UserMicroLoan>[] = [
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => (
      <div className="font-medium">{formatDate(row.original.disbursedAt ?? row.original.requestedAt, "PPP")}</div>
    ),
  },
  // Every row is a top-up: a loan's first payout is part of the loan, on the Loans tab.
  {
    id: "amount",
    header: "Amount",
    cell: ({ row }) => <div>{formatCurrency(row.original.amount)}</div>,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status as LoanStatus} />,
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => <UserMicroLoanModal item={row.original} />,
  },
];
