import type React from "react";
import { BrushCleaning } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";

interface EmptyStateProps {
  title?: string;
  description?: string;
  colSpan?: number;
}

export function TableEmptyState({
  title = "No recent activity",
  description = "Your recent activities will appear here once you start using the platform.",
  colSpan = 4,
}: EmptyStateProps) {
  return (
    <TableRow className="bg-background">
      <TableCell colSpan={colSpan} className="h-24 text-center">
        <div className="flex flex-col items-center justify-center py-12 text-center mx-auto w-full">
          <div className="rounded-full bg-muted p-4 mb-4">
            <BrushCleaning className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-muted-foreground text-wrap">{description}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
