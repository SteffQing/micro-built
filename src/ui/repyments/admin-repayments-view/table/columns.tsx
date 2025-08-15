"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import UserAvatarComponent from "@/ui/settings/user-settings-view/user-avatar";

const columns: ColumnDef<RepaymentsResponseDto>[] = [
  // {
  //   accessorKey: "id",
  //   header: "ID",
  //   cell: ({ row }) => <span className="text-muted-foreground">{row.getValue("id")}</span>,
  // },
  {
    accessorKey: "userId",
    header: "Customer ID",
    // cell: ({ row }) => <span className="font-medium">{row.getValue("userId")}</span>,
    cell: ({ row }) => {
      const id = row.getValue("userId") as string;
      return (
        <div className="flex items-center gap-3">
          <UserAvatarComponent id={id} className="w-8 h-8" />
          <span className="font-medium">{id ?? "Not found"}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "expectedAmount",
    header: "Expected",
    cell: ({ row }) => <span className="font-medium">{formatCurrency(row.getValue("expectedAmount"))}</span>,
  },
  {
    accessorKey: "repaidAmount",
    header: "Repaid",
    cell: ({ row }) => <span className="font-medium">{formatCurrency(row.getValue("repaidAmount"))}</span>,
  },
  {
    header: "Variant",
    cell: ({ row }) => {
      const expectedAmount = row.original.expectedAmount;
      const repaidAmount = row.original.repaidAmount;
      const variant = expectedAmount - repaidAmount;
      return <span className="font-medium">{formatCurrency(variant)}</span>;
    },
  },
  {
    accessorKey: "period",
    header: "Period",
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue("period")}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <span className="text-muted-foreground">{row.getValue("status")}</span>,
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
