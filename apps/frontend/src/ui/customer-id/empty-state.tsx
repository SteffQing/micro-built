import type { LucideIcon } from "lucide-react";
import { BrushCleaning } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";

export function EmptyState({
  title,
  description,
  icon: Icon = BrushCleaning,
  className = "py-20",
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      <Icon className="mb-4 size-7 text-foreground" strokeWidth={1.75} />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-[#999]">{description}</p>
    </div>
  );
}

export function TableEmpty({
  colSpan,
  title,
  description,
}: {
  colSpan: number;
  title: string;
  description: string;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <EmptyState title={title} description={description} />
      </TableCell>
    </TableRow>
  );
}
