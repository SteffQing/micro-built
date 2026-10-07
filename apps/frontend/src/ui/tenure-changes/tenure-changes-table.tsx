"use client";

import { CustomerNameLink } from "@/components/customer-name-link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Icon, icons } from "@/components/icon";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  approveTenureChangeAdmin,
  rejectTenureChangeAdmin,
} from "@/lib/mutations/admin/tenure-changes";
import { adminTenureChanges } from "@/lib/queries/admin/tenure-changes";
import { capitalize, cn, formatCurrency } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getLoanStatusColor } from "@/config/status";
import { FilterBuilder, type FilterConfig } from "@/components/filters/FilterBuilder";
import { useFilters } from "@/components/filters/useFilters";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TablePagination } from "@/ui/tables/pagination";

function StatusBadge({ status }: { status: TenureChangeStatus }) {
  return (
    <Badge variant="secondary" className={cn("border-transparent", getLoanStatusColor(status))}>
      {capitalize(status.toLowerCase())}
    </Badge>
  );
}

function TermChange({ before, after }: { before: number; after: number }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-muted-foreground">{before}</span>
      <span className="px-1.5">→</span>
      <strong className="font-medium text-foreground">{after} mo</strong>
    </span>
  );
}

function MoneyChange({
  before,
  after,
}: {
  before: number | null;
  after: number | null;
}) {
  if (before === null && after === null) return <span>—</span>;
  return (
    <div className="whitespace-nowrap tabular-nums">
      <span className="text-muted-foreground">
        {before === null ? "—" : formatCurrency(before)}
      </span>
      <span className="px-1.5">→</span>
      <strong className="font-medium text-foreground">
        {after === null ? "—" : formatCurrency(after)}
      </strong>
    </div>
  );
}

function ApproveDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AdminTenureChangeDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const approval = useMutation(approveTenureChangeAdmin(row.id));

  async function handleApprove() {
    try {
      await approval.mutateAsync();
      onOpenChange(false);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        toast.error("Already decided by another admin");
        queryClient.invalidateQueries({ queryKey: ["/admin/tenure-changes"] });
        onOpenChange(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve tenure change?</DialogTitle>
          <DialogDescription>
            This will approve the tenure change for {row.customer.name} from{" "}
            {row.previousTenure} to {row.previousTenure + row.monthsDelta} months.
            {row.proposedMonthly !== null && (
              <>
                {" "}
                The monthly deduction will change to approximately{" "}
                {formatCurrency(row.proposedMonthly)}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={approval.isPending}
          >
            Cancel
          </Button>
          <Button loading={approval.isPending} onClick={handleApprove}>
            Confirm approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AdminTenureChangeDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const rejection = useMutation(rejectTenureChangeAdmin(row.id));

  async function handleReject() {
    try {
      await rejection.mutateAsync(note.trim() ? { note: note.trim() } : undefined);
      onOpenChange(false);
      setNote("");
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        toast.error("Already decided by another admin");
        queryClient.invalidateQueries({ queryKey: ["/admin/tenure-changes"] });
        onOpenChange(false);
        setNote("");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject tenure change</DialogTitle>
          <DialogDescription>
            Reject the tenure change request for {row.customer.name}. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <Label htmlFor="reject-note" className="text-sm font-medium">
            Note (optional)
          </Label>
          <Textarea
            id="reject-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for rejection"
            className="min-h-[80px]"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={rejection.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={rejection.isPending}
            onClick={handleReject}
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionCell({ row }: { row: AdminTenureChangeDto }) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (row.status !== "PENDING") return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => setApproveOpen(true)}>
        <Icon icon={icons.check} size={14} /> Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => setRejectOpen(true)}
      >
        <Icon icon={icons.x} size={14} /> Reject
      </Button>
      <ApproveDialog row={row} open={approveOpen} onOpenChange={setApproveOpen} />
      <RejectDialog row={row} open={rejectOpen} onOpenChange={setRejectOpen} />
    </div>
  );
}

/**
 * A tenure change from a notification link (?change=<id>), shown above the table with its decision buttons because
 * it may sit on another page or filter. Pending ones only: not found means someone already decided it.
 */
function LinkedChange({ id }: { id: string }) {
  const { data, isLoading } = useQuery(adminTenureChanges({ status: "PENDING", limit: 100 }));
  const row = data?.data?.find((r) => r.id === id);
  if (isLoading) return null;
  if (!row) {
    return (
      <p role="status" className="border-b border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
        This tenure change was already decided.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 px-4 py-3 text-sm sm:px-5">
      <div className="flex items-center gap-3">
        <UserAvatar id={row.customer.id} name={row.customer.name} size={32} />
        <div>
          <p className="font-medium">{row.customer.name}</p>
          <TermChange before={row.previousTenure} after={row.previousTenure + row.monthsDelta} />
        </div>
      </div>
      <ActionCell row={row} />
    </div>
  );
}

const columns: ColumnDef<AdminTenureChangeDto>[] = [
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <UserAvatar id={row.original.customer.id} name={row.original.customer.name} size={32} />
        <CustomerNameLink id={row.original.customer.id} name={row.original.customer.name} />
      </div>
    ),
  },
  {
    id: "reason",
    header: "Reason",
    cell: ({ row }) => {
      const change = row.original;
      return (
        <>
          <span className="font-medium">{capitalize(change.reason.replace(/_/g, " ").toLowerCase())}</span>
          {change.reason === "DEFAULT" && (
            <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              {change.netPay !== null && <span>Net pay: {formatCurrency(change.netPay)}</span>}
              {change.cap !== null && <span>Cap: {formatCurrency(change.cap)}</span>}
            </div>
          )}
        </>
      );
    },
  },
  {
    id: "tenure",
    header: "Tenure Change",
    cell: ({ row }) => (
      <div>
        <TermChange before={row.original.previousTenure} after={row.original.previousTenure + row.original.monthsDelta} />
        {row.original.reprice && (
          <p className="mt-1 text-xs text-muted-foreground">
            Interest recalculated
            {row.original.interestAdded !== null && <>: +{formatCurrency(row.original.interestAdded)}</>}
          </p>
        )}
      </div>
    ),
  },
  {
    id: "monthly",
    header: "Monthly",
    cell: ({ row }) => <MoneyChange before={row.original.currentMonthly} after={row.original.proposedMonthly} />,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => format(new Date(row.original.createdAt), "PPP"),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ActionCell row={row.original} />,
  },
];

const filterConfig: FilterConfig[] = [
  {
    key: "status",
    type: "select",
    label: "Status",
    options: [
      { label: "All Statuses", value: "undefined" },
      { label: "Pending", value: "PENDING" },
      { label: "Approved", value: "APPROVED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },
];

export default function TenureChangesTable() {
  const linkedChange = useSearchParams().get("change");
  const initialState = useMemo(() => ({ status: undefined }), []);
  const { filters, setFilter, clearFilters, qDto, qString } = useFilters({ initialState });
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  // Back to the first page when the filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [qString]);

  const { data, isLoading } = useQuery(
    adminTenureChanges({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(qDto.status ? { status: String(qDto.status) as TenureChangeStatus } : {}),
    })
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    rowCount: data?.meta?.total ?? 0,
    pageCount: data?.meta ? Math.ceil(data.meta.total / data.meta.limit) : 0,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <Card className="w-full bg-background border gap-0">
      {linkedChange && <LinkedChange key={linkedChange} id={linkedChange} />}
      <div className="flex flex-wrap items-center justify-between gap-2 py-4 px-4 w-full">
        <h1 className="text-lg font-semibold">Tenure Changes</h1>
        <FilterBuilder
          config={filterConfig}
          state={filters}
          onChange={setFilter}
          onClear={clearFilters}
          triggerLabel="Filters"
          side="right"
        />
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-md">
          <Table>
            <TableHeader className="px-4">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="font-medium text-muted-foreground">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingSkeleton columns={columns.length} rows={10} />
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className={cn("border-b hover:bg-muted/50", row.original.id === linkedChange && "bg-primary/5")}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableEmptyState
                  colSpan={columns.length}
                  title="No tenure changes"
                  description="There are no tenure changes with the selected filters."
                />
              )}
            </TableBody>
          </Table>

          <div className="py-4 px-4">
            <TablePagination table={table} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
