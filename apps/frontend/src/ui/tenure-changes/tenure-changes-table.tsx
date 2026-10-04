"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useUserProvider } from "@/store/auth";
import { UserAvatar } from "@/components/user-avatar";

const PAGE_SIZE = 10;

function StatusBadge({ status }: { status: TenureChangeStatus }) {
  const map: Record<TenureChangeStatus, string> = {
    PENDING: "bg-warning/10 text-warning",
    APPROVED: "bg-success/10 text-success",
    REJECTED: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded px-2.5 py-1 text-xs font-medium",
        map[status],
      )}
    >
      {capitalize(status.toLowerCase())}
    </span>
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
            {row.previousTenure} to {row.tenure} months.
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
        <div className="flex flex-col gap-3 p-4 sm:p-5">
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

export default function TenureChangesTable() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const { data, isLoading } = useQuery(
    adminTenureChanges({
      page,
      limit: PAGE_SIZE,
      ...(status !== "all" && { status: status as TenureChangeStatus }),
    }),
  );
  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
        <h1 className="text-lg font-semibold">Tenure Changes</h1>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[1100px] text-sm">
          <TableHeader>
            <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
              <TableHead>Customer</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Tenure Change</TableHead>
              <TableHead>Monthly</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center">
                  <Icon
                    icon={icons.loaderCircle}
                    size={24}
                    className="mx-auto animate-spin text-muted-foreground"
                  />
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="[&>td]:px-3 [&>td]:py-3.5 [&>td:first-child]:pl-5 [&>td:last-child]:pr-5"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        id={row.customer.id}
                        name={row.customer.name}
                        size={32}
                      />
                      <span className="font-medium">{row.customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {capitalize(row.reason.replace(/_/g, " ").toLowerCase())}
                    </span>
                    {row.reason === "DEFAULT" && (
                      <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {row.netPay !== null && (
                          <span>Net pay: {formatCurrency(row.netPay)}</span>
                        )}
                        {row.cap !== null && (
                          <span>Cap: {formatCurrency(row.cap)}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <TermChange before={row.previousTenure} after={row.tenure} />
                  </TableCell>
                  <TableCell>
                    <MoneyChange
                      before={row.currentMonthly}
                      after={row.proposedMonthly}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    {format(new Date(row.createdAt), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionCell row={row} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                  No tenure changes found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-5">
          <span>
            {total} record{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Prev
            </Button>
            <span className="min-w-16 text-center">
              {page} of {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
