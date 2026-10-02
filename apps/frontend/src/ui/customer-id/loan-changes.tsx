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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { approveTenureChange, rejectTenureChange } from "@/lib/mutations/admin/customer";
import { adminExportReport } from "@/lib/mutations/admin/statement";
import {
  customerTenureChanges,
  customerTopups,
  customerReportPreview,
} from "@/lib/queries/admin/customer";
import { capitalize, cn, formatCurrency } from "@/lib/utils";
import PeriodRangeFilter, {
  type PeriodRangeValue,
} from "@/components/period-range-filter";
import { AdminStatementTable } from "@/ui/statement/statement-table";
import { TableEmpty } from "./empty-state";

const PAGE_SIZE = 6;

function ChangeStatus({ status }: { status: string }) {
  const approved = ["APPROVED", "DISBURSED", "REPAID"].includes(status);
  const rejected = status === "REJECTED";
  return (
    <span
      className={cn(
        "inline-flex rounded px-2.5 py-1 text-xs font-medium",
        approved && "bg-success/10 text-success",
        rejected && "bg-red-50 text-red-700",
        !approved && !rejected && "bg-amber-50 text-amber-700",
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
        <SheetHeader className="border-b border-border px-5 py-5">
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
      <Table className="min-w-[1180px] text-sm">
        <TableHeader>
          <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
            <TableHead>Date</TableHead>
            <TableHead>Top-up ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Tenure Change</TableHead>
            <TableHead>Disbursed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
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
                <TableCell className="text-right">
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
              title={isLoading ? "Loading top-ups…" : "No top-ups recorded"}
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
          className="flex-1 text-red-600 hover:text-red-700"
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
              {request.tenure} months ({request.monthsDelta > 0 ? "+" : ""}{request.monthsDelta} months).
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
          <div className="flex flex-col gap-3 py-2">
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
      <Table className="min-w-[1050px] text-sm">
        <TableHeader>
          <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
            <TableHead>Date</TableHead>
            <TableHead>Request ID</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Tenure</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
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
                    after={row.tenure}
                  />
                </TableCell>
                <TableCell>
                  <ChangeStatus status={row.status} />
                </TableCell>
                <TableCell className="text-right">
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
                          after={row.tenure}
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
                        value={row.requestedBy}
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
              title={
                isLoading
                  ? "Loading tenure changes…"
                  : "No tenure changes recorded"
              }
              description="Flexible-tenure requests and their approval history will appear here."
            />
          )}
        </TableBody>
      </Table>
      <Pager page={page} total={data?.meta?.total ?? 0} onPage={setPage} />
    </>
  );
}

function StatementTab({ customerId }: { customerId: string }) {
  return <AdminStatementTable customerId={customerId} />;
}

function ReportTab({ customerId }: { customerId: string }) {
  const [audience, setAudience] = useState<"admin" | "customer">("admin");
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });

  const params = {
    audience,
    ...(period.from && { from: period.from }),
    ...(period.to && { to: period.to }),
  };

  const { data, isLoading } = useQuery(customerReportPreview(customerId, params));
  const exportMut = useMutation(adminExportReport(customerId));

  const report = data?.data;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={audience}
            onValueChange={(v) => {
              if (v) setAudience(v as "admin" | "customer");
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="admin">Admin view</ToggleGroupItem>
            <ToggleGroupItem value="customer">Customer view</ToggleGroupItem>
          </ToggleGroup>
          <PeriodRangeFilter value={period} onChange={setPeriod} />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs"
          disabled={exportMut.isPending}
          onClick={() =>
            exportMut.mutate({
              audience,
              ...(period.from && { from: period.from }),
              ...(period.to && { to: period.to }),
              format: "pdf",
            })
          }
        >
          <Icon icon={icons.download} size={14} /> Generate &amp; email
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          Loading report preview…
        </div>
      ) : report ? (
        <div className="space-y-4 px-4 py-4 sm:px-5">
          {/* Customer info */}
          <div className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {report.customer.name}
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-3">
              {report.customer.externalId && (
                <span>ID: {report.customer.externalId}</span>
              )}
              {report.customer.phoneNumber && (
                <span>Phone: {report.customer.phoneNumber}</span>
              )}
              {report.customer.email && (
                <span>Email: {report.customer.email}</span>
              )}
              {report.customer.organization && (
                <span>Org: {report.customer.organization}</span>
              )}
              {report.customer.command && (
                <span>Command: {report.customer.command}</span>
              )}
              <span>
                Status:{" "}
                <span className="font-medium text-foreground">
                  {capitalize(report.customer.status.toLowerCase())}
                </span>
              </span>
            </div>
          </div>

          {/* Loans */}
          {report.loans.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active Loans
              </h4>
              <div className="space-y-3">
                {report.loans.map((loan) => (
                  <div
                    key={loan.id}
                    className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-xs sm:grid-cols-4"
                  >
                    <span className="col-span-2 font-medium text-foreground">
                      {loan.id} · {capitalize(loan.category.toLowerCase())} ·{" "}
                      {capitalize(loan.status.toLowerCase())}
                    </span>
                    <span>
                      Outstanding:{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatCurrency(loan.outstanding)}
                      </span>
                    </span>
                    <span>
                      Repaid:{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatCurrency(loan.repaid)}
                      </span>
                    </span>
                    <span>
                      Principal:{" "}
                      <span className="tabular-nums">
                        {formatCurrency(loan.principal)}
                      </span>
                    </span>
                    <span>
                      Interest:{" "}
                      <span className="tabular-nums">
                        {formatCurrency(loan.interestBooked)}
                      </span>
                    </span>
                    <span>
                      Tenure: {loan.tenure}mo ({loan.remainingMonths} remaining)
                    </span>
                    <span>
                      Monthly:{" "}
                      {loan.monthly ? formatCurrency(loan.monthly) : "—"}
                    </span>
                    {loan.commodity && (
                      <span className="col-span-2 text-muted-foreground">
                        Commodity: {loan.commodity.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statement summary */}
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Statement Summary ({report.range.fromLabel} – {report.range.toLabel})
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Opening</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(report.statement.opening)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Debits</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(report.statement.debits)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Credits</p>
                <p className="text-sm font-semibold tabular-nums text-success">
                  {formatCurrency(report.statement.credits)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Closing</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(report.statement.closing)}
                </p>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Totals
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Repaid</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(report.totals.repaid)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Outstanding</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(report.totals.outstanding)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Repayment Rate</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {(report.totals.repaymentRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Revenue (admin only) */}
          {report.revenue && (
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Revenue
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div>
                  <p className="text-[11px] text-muted-foreground">Interest Booked</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(report.revenue.interestBooked)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Interest Collected</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(report.revenue.interestCollected)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Mgmt Fee</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(report.revenue.managementFee)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Penalty Charged</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(report.revenue.penaltyCharged)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Penalty Collected</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(report.revenue.penaltyCollected)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Account officer (admin only) */}
          {report.accountOfficer && (
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account Officer
              </h4>
              <p className="text-sm text-foreground">
                {report.accountOfficer.name}
              </p>
            </div>
          )}

          {/* Notes (admin only) */}
          {report.notes && (
            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </h4>
              {report.notes.flagReason && (
                <p className="mb-2 text-sm text-amber-700">
                  Flag: {report.notes.flagReason}
                </p>
              )}
              {report.notes.history.length > 0 && (
                <div className="space-y-2">
                  {report.notes.history.map((note, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {note.action} — {note.actorName}
                        </span>
                        <span className="text-muted-foreground">
                          {format(new Date(note.createdAt), "d MMM yyyy")}
                        </span>
                      </div>
                      {note.note && (
                        <p className="mt-1 text-muted-foreground">
                          {note.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          No report data available for the selected period.
        </div>
      )}
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
        <SelectTrigger className="h-9 w-full sm:w-48">
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
          Top-ups, flexible-tenure decisions, and the complete account trail
          behind the current monthly deduction.
        </p>
      </div>
      <Separator className="bg-border" />
      <Tabs defaultValue="topups" className="gap-0">
        <div className="overflow-x-auto px-4 pt-3 sm:px-5">
          <TabsList className="w-full min-w-max justify-start bg-muted sm:w-fit">
            <TabsTrigger value="topups">Top-ups</TabsTrigger>
            <TabsTrigger value="tenure">Tenure Changes</TabsTrigger>
            <TabsTrigger value="statement">Account Statement</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="topups">
          <TopupsTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="tenure">
          <TenureTab customerId={customerId} adminRole={adminRole} />
        </TabsContent>
        <TabsContent value="statement">
          <StatementTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="report">
          <ReportTab customerId={customerId} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
