import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "date-fns";
import { UserCashLoanModal } from "../../modals";

const StatusBadge = ({ status }: { status: LoanStatus }) => {
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

const columns: ColumnDef<AllUserLoansDto>[] = [
  {
    id: "date",
    header: "Date",
    accessorKey: "date",
    cell: ({ row }) => <div className="font-medium">{formatDate(row.getValue("date"), "PPP")}</div>,
  },
  {
    accessorKey: "category",
    header: "Loan Type",
    cell: ({ row }) => {
      // A cash top-up carries its loan's category; it reads as what it is.
      if (row.original.kind === "TOPUP") return <div>Top-up</div>;
      const loanType = String(row.getValue("category")).toLowerCase().replace(/_/g, " ");
      return <div className="capitalize">{loanType}</div>;
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = row.getValue("amount") as number | null;
      if (amount === null) return <div>—</div>;
      const formatted = new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
      }).format(amount);
      return <div className="capitalize">{formatted}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status") as LoanStatus} />,
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => <UserCashLoanModal id={row.original.loanId} />,
  },
];

export default columns;
