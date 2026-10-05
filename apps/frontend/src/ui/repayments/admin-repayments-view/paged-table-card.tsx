"use client";

import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Icon, icons } from "@/components/icon";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TablePagination } from "@/ui/tables/pagination";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

type ListResult<T> = {
  data?: { data?: T[] | null; meta?: Meta } | null;
  isLoading: boolean;
  isFetching: boolean;
};

type Props<T> = {
  title: string;
  description?: string;
  columns: ColumnDef<T>[];
  /**
   * Runs the tab's query for one page. Called on every render, so it is a hook:
   * `(page, limit) => useQuery(...)`.
   */
  useList: (page: number, limit: number) => ListResult<T>;
  /**
   * Identifies the current filters. When it changes the table goes back to page 1,
   * without an effect: the page index is only trusted while its key still matches.
   */
  filterKey: string;
  /** Filter controls, rendered after the search box. */
  filters?: ReactNode;
  /** Extra buttons on the right of the toolbar (e.g. export). */
  actions?: ReactNode;
  searchPlaceholder: string;
  search: string;
  onSearchChange: (value: string) => void;
  emptyTitle: string;
  emptyDescription: string;
  /**
   * Render inside another card (e.g. a tab of the customer page): no card chrome or title row; the count and
   * actions move into the toolbar.
   */
  bare?: boolean;
};

/**
 * The card every Repayments tab shares: title + count, a wrapping toolbar, a server-paginated
 * table that scrolls inside its container, loading skeletons and an empty state.
 */
export function PagedTableCard<T>({
  title,
  description,
  columns,
  useList,
  filterKey,
  filters,
  actions,
  searchPlaceholder,
  search,
  onSearchChange,
  emptyTitle,
  emptyDescription,
  bare = false,
}: Props<T>) {
  const [pageState, setPageState] = useState({ key: filterKey, pageIndex: 0, pageSize: 10 });
  const pagination: PaginationState = {
    pageIndex: pageState.key === filterKey ? pageState.pageIndex : 0,
    pageSize: pageState.pageSize,
  };

  const { data, isLoading, isFetching } = useList(pagination.pageIndex + 1, pagination.pageSize);
  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row, index) => (row as { id?: string }).id ?? String(index),
    rowCount: total,
    pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
    state: { pagination },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      setPageState({ key: filterKey, ...next });
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const Shell = bare ? "div" : Card;
  const count = (
    <span
      className={cn(
        "rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground",
        isFetching && !isLoading && "animate-pulse",
      )}
    >
      {isLoading ? "…" : total.toLocaleString()}
    </span>
  );

  return (
    <Shell className={bare ? "min-w-0" : "gap-0 rounded-xl border bg-background p-0"}>
      {!bare && (
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            {count}
          </div>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <div className="relative w-full min-w-[200px] sm:w-72">
          <Icon
            icon={icons.search}
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 pl-8 text-sm"
          />
        </div>
        {filters}
        {bare && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{count} records</span>
            {actions}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap text-sm font-medium text-muted-foreground",
                      (header.column.columnDef.meta as { align?: "right" } | undefined)?.align === "right" &&
                        "text-right",
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoadingSkeleton columns={columns.length} rows={pagination.pageSize} />
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-b bg-background hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-3",
                        (cell.column.columnDef.meta as { align?: "right" } | undefined)?.align === "right" &&
                          "text-right",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableEmptyState
                colSpan={columns.length}
                title={emptyTitle}
                description={emptyDescription}
              />
            )}
          </TableBody>
        </Table>
      </div>

      <div className="p-4">
        <TablePagination table={table} />
      </div>
    </Shell>
  );
}

/** Search text with a 400ms debounce: `[text for the input, value to query with]`. */
export function useSearchState(): [string, (value: string) => void, string] {
  const [text, setText] = useState("");
  const debounced = useDebounce(text.trim(), 400);
  return [text, setText, debounced];
}

/** The page's period range as query params (a single bound is allowed). */
export function periodParams(period: { from: string; to: string }) {
  return {
    ...(period.from && { from: period.from }),
    ...(period.to && { to: period.to }),
  };
}

export const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

export const StatusPill = ({ label, className }: { label: string; className: string }) => (
  <span
    className={cn(
      "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
      className,
    )}
  >
    {label}
  </span>
);

export const customerCell =(customer: { name: string; externalId: string | null } | null, fallback = "Unlinked") => (
  <div className="min-w-0">
    <p className="truncate font-medium">{customer?.name ?? fallback}</p>
    {customer?.externalId && (
      <p className="text-xs text-muted-foreground tabular-nums">{customer.externalId}</p>
    )}
  </div>
);
