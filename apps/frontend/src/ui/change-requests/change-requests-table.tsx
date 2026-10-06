"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
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
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { approveChangeRequest, rejectChangeRequest } from "@/lib/mutations/admin/change-requests";
import { adminChangeRequests, base } from "@/lib/queries/admin/change-requests";
import { capitalize } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";
import { PagedTableCard, StatusPill, formatDate } from "@/ui/repayments/admin-repayments-view/paged-table-card";
import { ChangeDiff, fieldLabel, KIND_LABELS } from "./change-diff";

const STATUS: Record<ChangeRequestStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-warning/10 text-warning" },
  APPROVED: { label: "Approved", className: "bg-success/10 text-success" },
  REJECTED: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
  CANCELLED: { label: "Withdrawn", className: "bg-muted text-muted-foreground" },
};

function roleLabel(role: UserRole) {
  return role === "CUSTOMER" ? "Customer" : capitalize(role.replace(/_/g, " ").toLowerCase());
}

/** The request, compact: what changes, who decided, and approve / reject for those who may decide it. */
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{KIND_LABELS[row.kind]} change</DialogTitle>
          <DialogDescription>
            {row.user.name} · {roleLabel(row.user.role)} · {format(new Date(row.updatedAt), "d MMM yyyy, h:mm a")}
            {row.requestedBy && ` · proposed by ${row.requestedBy.name}`}
          </DialogDescription>
        </DialogHeader>
        <Separator className="bg-border" />
        <div className={`${dialogBodyClass} min-w-0 pt-4`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What changes</p>
            <StatusPill {...STATUS[row.status]} />
          </div>
          <div className="rounded-lg border px-3 py-2.5">
            <ChangeDiff request={row} />
          </div>

          {row.status !== "PENDING" && (row.decidedBy || row.note) && (
            <p className="text-xs text-muted-foreground">
              {row.decidedBy && `${STATUS[row.status].label} by ${row.decidedBy.name}`}
              {row.decidedAt && ` on ${formatDate(row.decidedAt)}`}
              {row.note && <span className="mt-1 block text-foreground">“{row.note}”</span>}
            </p>
          )}
          {row.status === "PENDING" && !row.canDecide && (
            <p className="text-xs text-muted-foreground">
              {row.user.id === user?.id
                ? "You can’t decide a change to your own details: another admin will."
                : row.requestedBy
                    ? "An admin proposed this change, so only a super admin can decide it."
                    : "Only a super admin can decide a change to an admin’s details."}
            </p>
          )}
          {rejecting && (
            <div className="grid gap-1.5">
              <Label htmlFor="reject-change-note">Reason, sent to {row.user.name}</Label>
              <Textarea
                id="reject-change-note"
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. The account name does not match your BVN"
                className="min-h-[72px]"
              />
            </div>
          )}

          <DialogFooter>
            {row.canDecide ? (
              rejecting ? (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => setRejecting(false)}>
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    loading={rejection.isPending}
                    onClick={() =>
                      decide(() => rejection.mutateAsync(note.trim() ? { note: note.trim() } : undefined))
                    }
                  >
                    Reject
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => setRejecting(true)}
                  >
                    Reject
                  </Button>
                  <Button loading={approval.isPending} disabled={busy} onClick={() => decide(() => approval.mutateAsync())}>
                    Approve
                  </Button>
                </>
              )
            ) : (
              <Button variant="outline" onClick={close} className="flex-1 bg-muted text-sm font-medium text-muted-foreground">
                Close
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewCell({ row }: { row: ChangeRequestDto }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="text-xs" onClick={() => setOpen(true)}>
        <Icon icon={icons.view} size={12} className="mr-1" />
        {row.canDecide ? "Review" : "View"}
      </Button>
      <ReviewDialog row={row} open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Opens one request from a notification link (?request=<id>). It may sit on another page or filter, so it is
 * looked up among the pending ones; not there means someone already decided it.
 */
function LinkedRequest({ id }: { id: string }) {
  const [open, setOpen] = useState(true);
  const { data, isLoading } = useQuery(adminChangeRequests({ status: "PENDING", limit: 100 }));
  const row = data?.data?.find((r) => r.id === id);
  const decided = !isLoading && !row;
  useEffect(() => {
    if (decided) toast.info("This request was already decided");
  }, [decided]);
  if (!row) return null;
  return <ReviewDialog row={row} open={open} onOpenChange={setOpen} />;
}

const person = (row: ChangeRequestDto): ReactNode => (
  <div className="min-w-0">
    {row.user.role === "CUSTOMER" ? (
      <Link href={`/customers/${row.user.id}`} className="truncate font-medium hover:underline">
        {row.user.name}
      </Link>
    ) : (
      <p className="truncate font-medium">{row.user.name}</p>
    )}
    <p className="text-xs text-muted-foreground">
      {roleLabel(row.user.role)}
      {row.requestedBy && ` · by ${row.requestedBy.name}`}
    </p>
  </div>
);

const columns: ColumnDef<ChangeRequestDto>[] = [
  { id: "person", header: "Person", cell: ({ row }) => person(row.original) },
  {
    id: "kind",
    header: "Change",
    cell: ({ row }) => <span className="whitespace-nowrap">{KIND_LABELS[row.original.kind]}</span>,
  },
  {
    id: "fields",
    header: "Fields",
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[16rem] text-xs text-muted-foreground">
        {Object.keys(row.original.proposed).map(fieldLabel).join(", ")}
      </span>
    ),
  },
  { id: "status", header: "Status", cell: ({ row }) => <StatusPill {...STATUS[row.original.status]} /> },
  {
    id: "asked",
    header: "Asked",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.original.updatedAt)}</span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: "right" },
    cell: ({ row }) => <ReviewCell row={row.original} />,
  },
];

export default function ChangeRequestsTable({ userId }: { userId?: string }) {
  const linkedRequest = useSearchParams().get("request");
  const [status, setStatus] = useState<ChangeRequestStatus | "ALL">("PENDING");
  const [kind, setKind] = useState<ChangeRequestKind | "ALL">("ALL");
  const params = {
    userId,
    ...(status !== "ALL" && { status }),
    ...(kind !== "ALL" && { kind }),
  };

  return (
    <>
      {/* Keyed by the link, so following another notification while here opens that one. */}
      {linkedRequest && <LinkedRequest key={linkedRequest} id={linkedRequest} />}
      <PagedTableCard
        title="Change requests"
        description="Identity, bank and profile changes wait here until an admin approves them"
        columns={columns}
        useList={(page, limit) =>
          // eslint-disable-next-line react-hooks/rules-of-hooks
          useQuery({ ...adminChangeRequests({ ...params, page, limit }), placeholderData: (prev) => prev })
        }
        filterKey={JSON.stringify(params)}
        filters={
          <>
            <Select value={kind} onValueChange={(v) => setKind(v as ChangeRequestKind | "ALL")}>
              <SelectTrigger className="h-9 w-[170px] text-sm" aria-label="Kind of change">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All changes</SelectItem>
                {(Object.keys(KIND_LABELS) as ChangeRequestKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as ChangeRequestStatus | "ALL")}>
              <SelectTrigger className="h-9 w-[150px] text-sm" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {(Object.keys(STATUS) as ChangeRequestStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        emptyTitle={status === "PENDING" ? "Nothing is waiting for approval" : "No change requests"}
        emptyDescription={
          status === "PENDING" ? "New requests appear here as customers and admins send them." : "No requests match these filters."
        }
      />
    </>
  );
}
