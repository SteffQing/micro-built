"use client";

import { useEffect, useMemo, useState } from "react";
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
  approveTopup,
  disburseTopup,
  rejectTopup,
} from "@/lib/mutations/admin/topups";
import { adminTopups } from "@/lib/queries/admin/topups";
import { capitalize, cn, formatCurrency } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";
import { UserAvatar } from "@/components/user-avatar";
import { NumericalInput } from "@/components/ui/numerical-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getLoanStatusColor } from "@/config/status";
import { FilterBuilder, type FilterConfig } from "@/components/filters/FilterBuilder";
import { useFilters } from "@/components/filters/useFilters";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";
import { TableEmptyState } from "@/ui/tables/table-empty-state";
import { TablePagination } from "@/ui/tables/pagination";

type TopupStatus = "PENDING" | "APPROVED" | "DISBURSED" | "REJECTED";

export function StatusBadge({ status }: { status: TopupStatus }) {
  return (
    <Badge variant="secondary" className={cn("border-transparent", getLoanStatusColor(status))}>
      {capitalize(status.toLowerCase())}
    </Badge>
  );
}

function ApproveTopupDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AdminTopupDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Starts at what was requested with the top-up; the approver may change or clear it.
  const requested = row.tenureChange?.status === "PENDING" ? row.tenureChange : null;
  const [monthsDelta, setMonthsDelta] = useState<number>(requested?.monthsDelta ?? 0);
  const [reprice, setReprice] = useState(requested?.reprice ?? false);
  const queryClient = useQueryClient();
  const approval = useMutation(approveTopup(row.id));

  async function handleApprove() {
    try {
      await approval.mutateAsync({ monthsDelta, reprice: monthsDelta > 0 && reprice });
      onOpenChange(false);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        toast.error("Already decided by another admin");
        queryClient.invalidateQueries({ queryKey: ["/admin/loans/topups"] });
        onOpenChange(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve top-up?</DialogTitle>
          <DialogDescription>
            Approve the top-up request for {row.customer.name}
            {row.amount !== null && <> of {formatCurrency(row.amount)}</>}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <Label htmlFor="months-delta" className="text-sm font-medium">
            Tenure change (months)
          </Label>
          <NumericalInput
            id="months-delta"
            value={monthsDelta}
            onValueChange={(v) => setMonthsDelta(v || 0)}
            emptyOnZero
            placeholder="0"
            min={-120}
            max={120}
            step={1}
            maxDecimals={0}
            aria-label="Months to add to the loan, negative to remove"
          />
          <p className="text-xs text-muted-foreground">
            {requested
              ? `Requested with the top-up: ${requested.monthsDelta > 0 ? "+" : ""}${requested.monthsDelta} months. `
              : "No tenure change was requested. "}
            Applied when the top-up is disbursed; 0 keeps the tenure as it is.
          </p>
          <RepriceCheckbox id={`reprice-${row.id}`} months={monthsDelta} checked={reprice} onChange={setReprice} />
        </div>
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

/** Whether added months also book interest on the running loan (lengthening only). */
export function RepriceCheckbox({
  id,
  months,
  checked,
  onChange,
}: {
  id: string;
  months: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const enabled = months > 0;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border p-3", !enabled && "opacity-60")}>
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={enabled && checked}
        disabled={!enabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <div className="grid gap-1">
        <Label htmlFor={id} className="text-sm font-medium">
          Recalculate interest for the added months
        </Label>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Also charges the running loan's principal still owed for each month added. Left off, only the top-up is charged interest."
            : "Only when months are added."}
        </p>
      </div>
    </div>
  );
}

function RejectTopupDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AdminTopupDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const rejection = useMutation(rejectTopup(row.id));

  async function handleReject() {
    try {
      await rejection.mutateAsync(note.trim() ? { note: note.trim() } : undefined);
      onOpenChange(false);
      setNote("");
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        toast.error("Already decided by another admin");
        queryClient.invalidateQueries({ queryKey: ["/admin/loans/topups"] });
        onOpenChange(false);
        setNote("");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject top-up</DialogTitle>
          <DialogDescription>
            Reject the top-up request for {row.customer.name}. This action
            cannot be undone.
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

function DisburseTopupDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AdminTopupDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const disbursement = useMutation(disburseTopup(row.id));

  async function handleDisburse() {
    try {
      await disbursement.mutateAsync();
      onOpenChange(false);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        toast.error("Already decided by another admin");
        queryClient.invalidateQueries({ queryKey: ["/admin/loans/topups"] });
        onOpenChange(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disburse top-up?</DialogTitle>
          <DialogDescription>
            This will disburse the approved top-up for {row.customer.name}
            {row.amount !== null && <> of {formatCurrency(row.amount)}</>} to the
            customer&apos;s account. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disbursement.isPending}
          >
            Cancel
          </Button>
          <Button loading={disbursement.isPending} onClick={handleDisburse}>
            Confirm disbursement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ActionCell({ row }: { row: AdminTopupDto }) {
  const { userRole } = useUserProvider();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [disburseOpen, setDisburseOpen] = useState(false);

  if (row.status === "PENDING") {
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
        <ApproveTopupDialog row={row} open={approveOpen} onOpenChange={setApproveOpen} />
        <RejectTopupDialog row={row} open={rejectOpen} onOpenChange={setRejectOpen} />
      </div>
    );
  }

  if (row.status === "APPROVED" && userRole === "SUPER_ADMIN") {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setDisburseOpen(true)}>
          <Icon icon={icons.moneyReceive} size={14} /> Disburse
        </Button>
        <DisburseTopupDialog row={row} open={disburseOpen} onOpenChange={setDisburseOpen} />
      </div>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}

const columns: ColumnDef<AdminTopupDto>[] = [
  {
    id: "customer",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <UserAvatar id={row.original.customer.id} name={row.original.customer.name} size={32} />
        <span className="font-medium">{row.original.customer.name}</span>
      </div>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {row.original.amount !== null ? formatCurrency(row.original.amount) : "—"}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "requested",
    header: "Requested",
    cell: ({ row }) => format(new Date(row.original.requestedAt), "PPP"),
  },
  {
    id: "disbursed",
    header: "Disbursed",
    cell: ({ row }) => (row.original.disbursedAt ? format(new Date(row.original.disbursedAt), "PPP") : "—"),
  },
  {
    id: "tenureChange",
    header: "Tenure Change",
    cell: ({ row }) => {
      const change = row.original.tenureChange;
      if (!change) return "—";
      return (
        <span className="whitespace-nowrap tabular-nums">
          {change.monthsDelta > 0 ? "+" : ""}
          {change.monthsDelta} mo{change.reprice ? " · repriced" : ""}{" "}
          <span className="text-xs text-muted-foreground">({capitalize(change.status.toLowerCase())})</span>
        </span>
      );
    },
  },
  {
    id: "asset",
    header: "Asset",
    cell: ({ row }) => row.original.asset?.name ?? "—",
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
      { label: "Disbursed", value: "DISBURSED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },
];

export default function TopupsTable() {
  const initialState = useMemo(() => ({ status: undefined }), []);
  const { filters, setFilter, clearFilters, qDto, qString } = useFilters({ initialState });
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  // Back to the first page when the filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [qString]);

  const { data, isLoading } = useQuery(
    adminTopups({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(qDto.status ? { status: String(qDto.status) } : {}),
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
      <div className="flex flex-wrap items-center justify-between gap-2 py-4 px-4 w-full">
        <h1 className="text-lg font-semibold">Top-ups</h1>
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
                  <TableRow key={row.id} className="border-b hover:bg-muted/50">
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
                  title="No top-ups"
                  description="There are no top-up requests with the selected filters."
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
