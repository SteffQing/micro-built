"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { getLoanStatusColor } from "@/config/status";
import { CommodityLoanModal } from "@/ui/modals";
import UserAvatarComponent from "@/ui/settings/user-settings-view/user-avatar";

const columns: ColumnDef<CommodityLoanItemDto>[] = [
  {
    id: "customer.id",
    header: "Customer",
    cell: ({ row }) => {
      const { id, name } = row.original.customer;
      return (
        <div className="flex items-center gap-3">
          <UserAvatarComponent id={id} name={name} className="w-8 h-8" />
          <span className="font-medium">{name}</span>
        </div>
      );
    },
  },
  {
    id: "IPPIS ID",
    header: "IPPIS ID",
    cell: ({ row }) => <span className="text-green-600 font-medium">{row.original.customer.externalId}</span>,
  },
  {
    accessorKey: "name",
    header: "Commodity Name",
    cell: ({ row }) => <Badge variant="outline">{row.getValue("name")}</Badge>,
  },
  {
    accessorKey: "date",
    header: "Request Date",
    cell: ({ row }) => formatDate(row.getValue("date"), "PPP"),
  },
  {
    accessorKey: "loanId",
    header: "Cash Loan ID",
    cell: ({ row }) => `${row.getValue("loanId") === null ? "N/A" : row.getValue("loanId")}`,
  },
  {
    accessorKey: "inReview",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={getLoanStatusColor((row.getValue("inReview") as boolean) === true ? "PENDING" : "APPROVED")}
      >
        {row.getValue("inReview") ? "In Review" : "Reviewed"}
      </Badge>
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => <CommodityLoanModal id={row.original.id} />,
  },
];

export default columns;
