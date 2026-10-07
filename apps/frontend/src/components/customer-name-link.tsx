import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A customer's name as a link to their page. Rows that open a details modal on click don't open it too: the click
 * stops here.
 */
export function CustomerNameLink({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <Link
      href={`/customers/${id}`}
      onClick={(event) => event.stopPropagation()}
      className={cn("font-medium underline-offset-2 hover:text-primary hover:underline", className)}
    >
      {name}
    </Link>
  );
}
