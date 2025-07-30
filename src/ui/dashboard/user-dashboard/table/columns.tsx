import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Dialog } from "@radix-ui/react-dialog";
import { DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDate } from "date-fns";
import { Separator } from "@/components/ui/separator";

const columns: ColumnDef<UserActivityDto>[] = [
  {
    id: "date",
    accessorKey: "date",
    header: ({}) => <p>Date</p>,
    cell: ({ row }) => <div className="flex items-center gap-1.5">{formatDate(row.getValue("date"), "PPP")}</div>,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue("title")}</div>;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => <div className="text-green-700 font-medium">{row.getValue("description")}</div>,
  },
];

export default columns;
