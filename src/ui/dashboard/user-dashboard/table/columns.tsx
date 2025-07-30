import { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "date-fns";

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
