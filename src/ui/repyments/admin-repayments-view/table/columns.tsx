"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const columns: ColumnDef<RepaymentsResponseDto>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("id")}</span>
    ),
  },
  {
    accessorKey: "userId",
    header: "Customer ID",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("userId")}</span>
    ),
  },
  {
    accessorKey: "expectedAmount",
    header: "Expected Amount",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("expectedAmount"))}
      </span>
    ),
  },
  {
    accessorKey: "repaidAmount",
    header: "Amount Repaid",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("repaidAmount"))}
      </span>
    ),
  },
  {
    accessorKey: "period",
    header: "Period",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("period")}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("status")}</span>
    ),
  },
  {
    header: "View",
    cell: ({}) => (
      <Dialog>
        <DialogTrigger>
          <Button variant="outline">View</Button>
        </DialogTrigger>
        <DialogContent></DialogContent>
      </Dialog>
    ),
  },
];

export default columns;
