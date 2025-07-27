import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "date-fns";
import { UserCashLoanModal } from "../../modals";

const StatusBadge = ({ status }: Pick<CashLoanItemDto, "status">) => {
  const statusConfig = {
    PENDING: {
      variant: "bg-orange-100 text-orange-800 border-orange-200",
      label: "Pending",
    },
    PREVIEW: {
      variant: "bg-blue-100 text-blue-800 border-blue-200",
      label: "Preview",
    },
    REJECTED: {
      variant: "bg-red-100 text-red-800 border-red-200",
      label: "Rejected",
    },
    ACCEPTED: {
      variant: "bg-green-100 text-green-800 border-green-200",
      label: "Accepted",
    },
    APPROVED: {
      variant: "bg-green-100 text-green-800 border-green-200",
      label: "Approved",
    },
    DISBURSED: {
      variant: "bg-purple-100 text-purple-800 border-purple-200",
      label: "Disbursed",
    },
    REPAID: {
      variant: "bg-emerald-100 text-emerald-800 border-emerald-200",
      label: "Repaid",
    },
  }[status] || {
    variant: "bg-gray-100 text-gray-800 border-gray-200",
    label: status,
  };

  return <Badge className={`${statusConfig.variant} border font-medium px-2 py-1`}>{statusConfig.label}</Badge>;
};

const columns: ColumnDef<CashLoanItemDto>[] = [
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
      const loanType = String(row.getValue("category")).toLowerCase().replace(/_/g, " ");
      return <div className="capitalize">{loanType}</div>;
    },
  },
  {
    accessorKey: "id",
    header: "Request Id",
    cell: ({ row }) => {
      const requestId = String(row.getValue("id"));
      return <div className="font-medium">{requestId}</div>;
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
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
    cell: ({ row }) => <UserCashLoanModal id={row.getValue("id") as string} />,
  },
];

export default columns;
