"use client";

import { Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { AVATAR_HOST } from "@/config/constants";
import { getLoanStatusColor } from "@/config/status";
import Link from "next/link";

const columns: ColumnDef<CommodityLoanItemDto>[] = [
  {
    accessorKey: "customerId",
    header: "Customer ID",
    cell: ({ row }) => {
      const id = row.getValue("customerId") as string;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={AVATAR_HOST + id} alt={id} />
            <AvatarFallback>{id}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{id}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "id",
    header: "Loan ID",
    cell: ({ row }) => (
      <span className="text-green-600 font-medium">{row.getValue("id")}</span>
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
    accessorKey: "loanId",
    header: "Cash Loan ID",
    cell: ({ row }) => `${row.getValue("loanId")}`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={getLoanStatusColor(row.getValue("status") as LoanStatus)}
      >
        {row.getValue("status")}
      </Badge>
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: ({ row }) => (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/loans/commodity/${row.original.id}`}>
          <Eye className="h-4 w-4 mr-1" />
          View
        </Link>
      </Button>
    ),
  },
];

export default columns;
