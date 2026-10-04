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
  approveTopup,
  disburseTopup,
  rejectTopup,
} from "@/lib/mutations/admin/topups";
import { adminTopups } from "@/lib/queries/admin/topups";
import { capitalize, cn, formatCurrency } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";
import { UserAvatar } from "@/components/user-avatar";
import { NumericalInput } from "@/components/ui/numerical-input";

const PAGE_SIZE = 10;

type TopupStatus = "PENDING" | "APPROVED" | "DISBURSED" | "REJECTED";

function StatusBadge({ status }: { status: TopupStatus }) {
  const map: Record<TopupStatus, string> = {
    PENDING: "bg-warning/10 text-warning",
    APPROVED: "bg-brand/10 text-brand",
    DISBURSED: "bg-success/10 text-success",
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

function ApproveTopupDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AdminTopupDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [monthsDelta, setMonthsDelta] = useState<number | undefined>(undefined);
  const queryClient = useQueryClient();
  const approval = useMutation(approveTopup(row.id));

  async function handleApprove() {
    try {
      await approval.mutateAsync(
        monthsDelta !== undefined && monthsDelta > 0
          ? { monthsDelta }
          : undefined,
      );
      onOpenChange(false);
      setMonthsDelta(undefined);
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
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <Label htmlFor="months-delta" className="text-sm font-medium">
            Tenure adjustment (optional)
          </Label>
          <NumericalInput
            value={monthsDelta ?? 0}
            onValueChange={(v) => setMonthsDelta(v || undefined)}
            emptyOnZero
            min={1}
            max={120}
            step={1}
            maxDecimals={0}
            aria-label="Months delta for tenure change"
          />
          <p className="text-xs text-muted-foreground">
            If set, this will adjust the loan tenure by the specified number of
            months upon approval.
          </p>
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

function ActionCell({ row }: { row: AdminTopupDto }) {
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

export default function TopupsTable() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const { data, isLoading } = useQuery(
    adminTopups({
      page,
      limit: PAGE_SIZE,
      ...(status !== "all" && { status }),
    }),
  );
  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
        <h1 className="text-lg font-semibold">Top-ups</h1>
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
            <SelectItem value="DISBURSED">Disbursed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[1100px] text-sm">
          <TableHeader>
            <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Disbursed</TableHead>
              <TableHead>Tenure Change</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
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
                  <TableCell className="tabular-nums">
                    {row.amount !== null ? formatCurrency(row.amount) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    {format(new Date(row.requestedAt), "d MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    {row.disbursedAt
                      ? format(new Date(row.disbursedAt), "d MMM yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {row.tenureChange ? (
                      <span className="whitespace-nowrap tabular-nums">
                        +{row.tenureChange.monthsDelta} mo{" "}
                        <span className="text-xs text-muted-foreground">
                          ({capitalize(row.tenureChange.status.toLowerCase())})
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {row.asset ? row.asset.name : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionCell row={row} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                  No top-ups found
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
