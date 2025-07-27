import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Dialog } from "@radix-ui/react-dialog";
import { DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDate } from "date-fns";

const columns: ColumnDef<UserActivityDto>[] = [
  {
    id: "date",
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
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => <ActivityData {...row.original} />,
  },
];

function ActivityData({ title, description, date, source }: UserActivityDto) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Activity Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Title</label>
            <p className="text-sm">{title}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <p className="text-sm">{description}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Date</label>
            <p className="text-sm">{formatDate(date, "PPpp")}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Source</label>
            <p className="text-sm">{source}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default columns;
