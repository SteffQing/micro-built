"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/lib/utils";
import UserAvatarComponent from "@/ui/settings/user-settings-view/user-avatar";
import { AdminRepaymentModal } from "@/ui/modals/repayments";

const columns: ColumnDef<RepaymentsHistoryDto>[] = [
  {
    id: "user.id",
    header: "Customer",
    cell: ({ row }) => {
      const { user } = row.original;
      return (
        <div className="flex items-center gap-3">
          <UserAvatarComponent
            id={user?.id}
            name={user?.name}
            className="w-8 h-8"
          />
          <span className="font-medium">{user?.name ?? "Not Linked"}</span>
        </div>
      );
    },
  },
  {
    id: "IPPIS ID",
    header: "IPPIS ID",
    cell: ({ row }) => (
      <span className="text-green-600 font-medium">
        {row.original.user?.externalId ?? "Not Found"}
      </span>
    ),
  },
  {
    accessorKey: "expectedAmount",
    header: "Expected",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("expectedAmount"))}
      </span>
    ),
  },
  {
    accessorKey: "repaidAmount",
    header: "Repaid",
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.getValue("repaidAmount"))}
      </span>
    ),
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
    accessorKey: "id",
    header: "View",
    cell: ({ row }) => <AdminRepaymentModal id={row.getValue("id")} />,
  },
];

export default columns;
