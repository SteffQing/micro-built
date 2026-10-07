"use client";

import { useDeferredValue, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { approveTenureChange, rejectTenureChange } from "@/lib/mutations/admin/customer";
import {
  customerTenureChanges,
  customerTopups,
} from "@/lib/queries/admin/customer";
import { capitalize, cn, formatCurrency } from "@/lib/utils";
import { TableEmpty } from "./empty-state";
import { TableLoadingSkeleton } from "@/ui/tables/table-skeleton-loader";

const PAGE_SIZE = 6;
// The Details column stays in view while the wide table scrolls sideways (phones, narrow windows).
const PINNED =
  "sticky right-0 z-10 bg-background shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.15)] [tr:hover>&]:bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))]";

function ChangeStatus({ status }: { status: string }) {
  const approved = ["APPROVED", "DISBURSED", "REPAID"].includes(status);
  const rejected = status === "REJECTED";
  return (
    <span
      className={cn(
        "inline-flex rounded px-2.5 py-1 text-xs font-medium",
        approved && "bg-success/10 text-success",
        rejected && "bg-destructive/10 text-destructive",
        !approved && !rejected && "bg-warning/10 text-warning",
      )}
    >
      {status === "DISBURSED"
        ? "Applied"
        : capitalize(status.toLowerCase().replace(/_/g, " "))}
    </span>
  );
}

function TermChange({
  before,
  after,
}: {
  before: number | null;
  after: number | null;
}) {
  if (before === null && after === null) return <span>—</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-muted-foreground">{before ?? "—"}</span>
      <span className="px-1.5">→</span>
      <strong className="font-medium text-foreground">
        {after ?? "—"} months
      </strong>
    </span>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4 border-b border-border py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words text-right font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function DetailSheet({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Icon icon={icons.view} size={14} /> View
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-5 pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-5">
      <span>
        {total} record{total === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
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
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function TopupsTab({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const { data, isLoading } = useQuery(
    customerTopups(customerId, {
      page,
      limit: PAGE_SIZE,
      ...(deferredSearch && { search: deferredSearch }),
      ...(status !== "all" && { status: status as LoanStatus }),
    }),
  );
  const rows = data?.data ?? [];

  return (
    <>
      <RecordsToolbar
        search={search}
        setSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        status={status}
        setStatus={(value) => {
          setStatus(value);
          setPage(1);
        }}
        statuses={["PENDING", "APPROVED", "DISBURSED", "REPAID", "REJECTED"]}
      />
      <Table className="min-w-[960px] text-sm">
        <TableHeader>
          <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
            <TableHead>Date</TableHead>
            <TableHead>Top-up ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Tenure Change</TableHead>
            <TableHead>Disbursed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className={cn("text-right", PINNED)}>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoadingSkeleton columns={7} />
          ) : rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="[&>td]:px-3 [&>td]:py-3.5 [&>td:first-child]:pl-5 [&>td:last-child]:pr-5"
              >
                <TableCell>
                  {format(new Date(row.requestedAt), "d MMM yyyy")}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {row.id}
                </TableCell>
                <TableCell>
                  {row.recordType === "ASSET_REQUEST"
                    ? `Asset · ${row.asset?.name ?? "—"}`
                    : "Cash"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.amount === null
                    ? "Set at approval"
                    : formatCurrency(row.amount)}
                </TableCell>
                <TableCell>
                  {row.tenureChange
                    ? `${row.tenureChange.monthsDelta > 0 ? "+" : ""}${row.tenureChange.monthsDelta} months`
                    : "—"}
                </TableCell>
                <TableCell>
                  {row.disbursedAt
                    ? format(new Date(row.disbursedAt), "d MMM yyyy")
                    : "—"}
                </TableCell>
                <TableCell>
                  <ChangeStatus status={row.status} />
                </TableCell>
                <TableCell className={cn("text-right", PINNED)}>
                  <DetailSheet
                    title={`Top-up ${row.id}`}
                    description="Top-up request details."
                  >
                    <DetailItem
                      label="Loan ID"
                      value={row.loanId ?? "Created after approval"}
                    />
                    <DetailItem
                      label="Type"
                      value={
                        row.recordType === "ASSET_REQUEST"
                          ? `Asset purchase · ${row.asset?.name ?? "—"}`
                          : "Cash"
                      }
                    />
                    <DetailItem
                      label="Amount"
                      value={
                        row.amount === null
                          ? "Not set"
                          : formatCurrency(row.amount)
                      }
                    />
                    <DetailItem
                      label="Requested"
                      value={format(
                        new Date(row.requestedAt),
                        "d MMM yyyy, h:mm a",
                      )}
                    />
                    {row.tenureChange && (
                      <DetailItem
                        label="Tenure change"
                        value={`${row.tenureChange.monthsDelta > 0 ? "+" : ""}${row.tenureChange.monthsDelta} months (${row.tenureChange.status})`}
                      />
                    )}
                    {row.disbursedAt && (
                      <DetailItem
                        label="Disbursed"
                        value={format(
                          new Date(row.disbursedAt),
                          "d MMM yyyy, h:mm a",
                        )}
                      />
                    )}
                  </DetailSheet>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={7}
              title="No top-ups recorded"
              description="Top-up requests and their consolidation calculations will appear here."
            />
          )}
        </TableBody>
      </Table>
      <Pager page={page} total={data?.meta?.total ?? 0} onPage={setPage} />
    </>
  );
}

function TenureApprovalAction({
  customerId,
  request,
}: {
  customerId: string;
  request: CustomerTenureChangeHistoryDto;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const approval = useMutation(approveTenureChange(request.id, customerId));
  const rejection = useMutation(rejectTenureChange(request.id, customerId));

  async function handleApprove() {
    await approval.mutateAsync();
    setIsConfirmOpen(false);
  }

  async function handleReject() {
    await rejection.mutateAsync(rejectNote.trim() ? { note: rejectNote.trim() } : undefined);
    setIsRejectOpen(false);
    setRejectNote("");
  }

  return (
    <>
      <div className="mt-5 flex gap-2">
        <Button
          className="flex-1"
          onClick={() => setIsConfirmOpen(true)}
          disabled={approval.isPending || rejection.isPending}
        >
          <Icon icon={icons.check} size={16} /> Approve
        </Button>
        <Button
          variant="outline"
          className="flex-1 text-destructive hover:text-destructive"
          onClick={() => setIsRejectOpen(true)}
          disabled={approval.isPending || rejection.isPending}
        >
          <Icon icon={icons.x} size={16} /> Reject
        </Button>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve tenure change?</DialogTitle>
            <DialogDescription>
              This will change the loan tenure from {request.previousTenure} to{" "}
              {request.previousTenure + request.monthsDelta} months ({request.monthsDelta > 0 ? "+" : ""}{request.monthsDelta} months).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
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

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject tenure change?</DialogTitle>
            <DialogDescription>
              Reject the tenure change request. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
            <Label htmlFor="tenure-reject-note" className="text-sm font-medium">
              Note (optional)
            </Label>
            <Textarea
              id="tenure-reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for rejection"
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectOpen(false)}
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
    </>
  );
}

function TenureTab({
  customerId,
  adminRole,
}: {
  customerId: string;
  adminRole: UserRole;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const { data, isLoading } = useQuery(
    customerTenureChanges(customerId, {
      page,
      limit: PAGE_SIZE,
      ...(deferredSearch && { search: deferredSearch }),
      ...(status !== "all" && {
        status: status as "PENDING" | "APPROVED" | "REJECTED",
      }),
    }),
  );
  const rows = data?.data ?? [];
  return (
    <>
      <RecordsToolbar
        search={search}
        setSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        status={status}
        setStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
        statuses={["PENDING", "APPROVED", "REJECTED"]}
      />
      <Table className="min-w-[820px] text-sm">
        <TableHeader>
          <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
            <TableHead>Date</TableHead>
            <TableHead>Request ID</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Tenure</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className={cn("text-right", PINNED)}>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoadingSkeleton columns={6} />
          ) : rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="[&>td]:px-3 [&>td]:py-3.5 [&>td:first-child]:pl-5 [&>td:last-child]:pr-5"
              >
                <TableCell>
                  {format(new Date(row.createdAt), "d MMM yyyy")}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {row.id}
                </TableCell>
                <TableCell>
                  {capitalize(row.reason.replace(/_/g, " ").toLowerCase())}
                </TableCell>
                <TableCell>
                  <TermChange
                    before={row.previousTenure}
                    after={row.previousTenure + row.monthsDelta}
                  />
                </TableCell>
                <TableCell>
                  <ChangeStatus status={row.status} />
                </TableCell>
                <TableCell className={cn("text-right", PINNED)}>
                  <DetailSheet
                    title={`Tenure request ${row.id}`}
                    description="The requested tenure change."
                  >
                    <DetailItem
                      label="Status"
                      value={<ChangeStatus status={row.status} />}
                    />
                    <DetailItem
                      label="Loan ID"
                      value={row.loanId}
                    />
                    <DetailItem
                      label="Reason"
                      value={capitalize(
                        row.reason.replace(/_/g, " ").toLowerCase(),
                      )}
                    />
                    <DetailItem
                      label="Tenure"
                      value={
                        <TermChange
                          before={row.previousTenure}
                          after={row.previousTenure + row.monthsDelta}
                        />
                      }
                    />
                    <DetailItem
                      label="Months delta"
                      value={`${row.monthsDelta > 0 ? "+" : ""}${row.monthsDelta}`}
                    />
                    {row.requestedBy && (
                      <DetailItem
                        label="Requested by"
                        value={row.requestedBy.name}
                      />
                    )}
                    {row.topupId && (
                      <DetailItem
                        label="Linked top-up"
                        value={row.topupId}
                      />
                    )}
                    {adminRole === "SUPER_ADMIN" && row.status === "PENDING" && (
                      <TenureApprovalAction
                        customerId={customerId}
                        request={row}
                      />
                    )}
                  </DetailSheet>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={6}
              title="No tenure changes recorded"
              description="Flexible-tenure requests and their approval history will appear here."
            />
          )}
        </TableBody>
      </Table>
      <Pager page={page} total={data?.meta?.total ?? 0} onPage={setPage} />
    </>
  );
}

function RecordsToolbar({
  search,
  setSearch,
  status,
  setStatus,
  statuses,
}: {
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  statuses: string[];
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:px-5">
      <div className="relative w-full sm:w-72">
        <Icon icon={icons.search} size={16} className="absolute inset-y-0 left-3 my-auto text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search records"
          className="h-9 bg-muted pl-9"
        />
      </div>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {statuses.map((item) => (
            <SelectItem key={item} value={item}>
              {capitalize(item.toLowerCase())}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function LoanChanges({
  customerId,
  adminRole,
}: {
  customerId: string;
  adminRole: UserRole;
}) {
  return (
    <Card className="gap-0 overflow-hidden bg-background p-0">
      <div className="px-4 py-4 sm:px-5">
        <h2 className="font-semibold text-foreground">Loan Changes</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Top-ups and flexible-tenure decisions behind the current monthly deduction.
        </p>
      </div>
      <Separator className="bg-border" />
      <Tabs defaultValue="topups" className="gap-0">
        <div className="overflow-x-auto px-4 pt-3 sm:px-5">
          <TabsList className="w-full min-w-max justify-start bg-muted sm:w-fit">
            <TabsTrigger value="topups">Top-ups</TabsTrigger>
            <TabsTrigger value="tenure">Tenure Changes</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="topups">
          <TopupsTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="tenure">
          <TenureTab customerId={customerId} adminRole={adminRole} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
