"use client";

import { CustomerNameLink } from "@/components/customer-name-link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { getLoanStatusColor } from "@/config/status";
import { cn } from "@/lib/utils";
import { CommodityLoanModal } from "@/ui/modals";
import { UserAvatar } from "@/components/user-avatar";

const columns: ColumnDef<CommodityLoanItemDto>[] = [
  {
    id: "customer.id",
    header: "Customer",
    cell: ({ row }) => {
      const { id, name } = row.original.customer;
      return (
        <div className="flex items-center gap-3">
          <UserAvatar id={id} name={name} size={32} />
          <CustomerNameLink id={id} name={name} />
        </div>
      );
    },
  },
  {
    id: "IPPIS ID",
    header: "IPPIS ID",
    cell: ({ row }) => (
      <span className="text-success font-medium">
        {row.original.customer.externalId}
      </span>
    ),
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
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={cn("border-transparent", getLoanStatusColor(row.getValue("status") as LoanStatus))}
      >
        {row.getValue("status")}
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
