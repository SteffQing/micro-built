"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { approveChangeRequest, rejectChangeRequest } from "@/lib/mutations/admin/change-requests";
import { adminChangeRequests, base } from "@/lib/queries/admin/change-requests";
import { capitalize, cn } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";
import { ChangeDiff, fieldLabel, KIND_LABELS } from "./change-diff";

const PAGE_SIZE = 10;

function StatusBadge({ status }: { status: ChangeRequestStatus }) {
  const map: Record<ChangeRequestStatus, string> = {
    PENDING: "bg-warning/10 text-warning",
    APPROVED: "bg-success/10 text-success",
    REJECTED: "bg-destructive/10 text-destructive",
    CANCELLED: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex rounded px-2.5 py-1 text-xs font-medium", map[status])}>
      {status === "CANCELLED" ? "Withdrawn" : capitalize(status.toLowerCase())}
    </span>
  );
}

function roleLabel(role: UserRole) {
  return role === "CUSTOMER" ? "Customer" : capitalize(role.replace(/_/g, " ").toLowerCase());
}

/** The whole request, with approve and reject for those who may decide it. */
function ReviewDialog({
  row,
  open,
  onOpenChange,
}: {
  row: ChangeRequestDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const { user } = useUserProvider();
  const queryClient = useQueryClient();
  const approval = useMutation(approveChangeRequest(row.id));
  const rejection = useMutation(rejectChangeRequest(row.id));
  const busy = approval.isPending || rejection.isPending;

  function close() {
    onOpenChange(false);
    setRejecting(false);
    setNote("");
  }

  async function decide(work: () => Promise<unknown>) {
    try {
      await work();
      close();
    } catch (err) {
      // 409: decided by someone else, or a detail was taken meanwhile; 403: not theirs to decide.
      if (isAxiosError(err) && (err.response?.status === 409 || err.response?.status === 403)) {
        toast.error(err.response.data?.message ?? "This request can no longer be decided");
        queryClient.invalidateQueries({ queryKey: [base] });
        close();
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {KIND_LABELS[row.kind]} change — {row.user.name}
          </DialogTitle>
          <DialogDescription>
            {roleLabel(row.user.role)} · asked {format(new Date(row.updatedAt), "d MMM yyyy, h:mm a")}. Approving
            replaces the live details with the new ones.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <ChangeDiff request={row} />
          {row.status !== "PENDING" && (
            <p className="text-sm text-muted-foreground">
              <StatusBadge status={row.status} />{" "}
              {row.decidedBy && `by ${row.decidedBy.name}`}
              {row.decidedAt && ` on ${format(new Date(row.decidedAt), "d MMM yyyy")}`}
              {row.note && ` — ${row.note}`}
            </p>
          )}
          {row.status === "PENDING" && !row.canDecide && (
            <p className="text-sm text-muted-foreground">
              {row.user.id === user?.id
                ? "You can’t decide a change to your own details: another admin will."
                : "Only a super admin can decide a change to an admin’s details."}
            </p>
          )}
          {rejecting && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reject-change-note">Reason (sent to {row.user.name})</Label>
              <Textarea
                id="reject-change-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. The account name does not match your BVN"
                className="min-h-[80px]"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            Close
          </Button>
          {row.canDecide &&
            (rejecting ? (
              <Button
                variant="destructive"
                loading={rejection.isPending}
                onClick={() => decide(() => rejection.mutateAsync(note.trim() ? { note: note.trim() } : undefined))}
              >
                Confirm rejection
              </Button>
            ) : (
              <>
                <Button variant="outline" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => setRejecting(true)}>
                  <Icon icon={icons.x} size={14} /> Reject
                </Button>
                <Button loading={approval.isPending} disabled={busy} onClick={() => decide(() => approval.mutateAsync())}>
                  <Icon icon={icons.check} size={14} /> Approve
                </Button>
              </>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewCell({ row }: { row: ChangeRequestDto }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={row.canDecide ? "default" : "outline"} onClick={() => setOpen(true)}>
        {row.canDecide ? "Review" : "View"}
      </Button>
      <ReviewDialog row={row} open={open} onOpenChange={setOpen} />
    </>
  );
}

export default function ChangeRequestsTable({ userId }: { userId?: string }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("PENDING");
  const [kind, setKind] = useState<string>("all");
  const { data, isLoading } = useQuery(
    adminChangeRequests({
      page,
      limit: PAGE_SIZE,
      userId,
      ...(status !== "all" && { status: status as ChangeRequestStatus }),
      ...(kind !== "all" && { kind: kind as ChangeRequestKind }),
    }),
  );
  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-5">
        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Changes to identity, bank and profile details wait here until an admin approves them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-44" aria-label="Filter by kind">
              <SelectValue placeholder="All changes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All changes</SelectItem>
              {(Object.keys(KIND_LABELS) as ChangeRequestKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-40" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[900px] text-sm">
          <TableHeader>
            <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
              <TableHead>Person</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Asked</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <Icon icon={icons.loaderCircle} size={24} className="mx-auto animate-spin text-muted-foreground" />
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
                      <UserAvatar id={row.user.id} name={row.user.name} size={32} />
                      <div className="min-w-0">
                        {row.user.role === "CUSTOMER" ? (
                          <Link href={`/customers/${row.user.id}`} className="font-medium hover:underline">
                            {row.user.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{row.user.name}</span>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {roleLabel(row.user.role)} · {row.user.id}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{KIND_LABELS[row.kind]}</TableCell>
                  <TableCell className="max-w-[18rem] text-muted-foreground">
                    {Object.keys(row.proposed).map(fieldLabel).join(", ")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{format(new Date(row.updatedAt), "d MMM yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <ReviewCell row={row} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                  {status === "PENDING" ? "Nothing is waiting for approval" : "No change requests found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-5">
          <span>
            {total} request{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </Button>
            <span className="min-w-16 text-center">
              {page} of {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
