"use client";

import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Eye, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
import {
  customerLoanStatement,
  customerTenureChanges,
  customerTopups,
} from "@/lib/queries/admin/customer";
import { capitalize, cn, formatCurrency } from "@/lib/utils";
import { TableEmpty } from "./empty-state";

const PAGE_SIZE = 6;

function ChangeStatus({ status }: { status: string }) {
  const approved = ["APPROVED", "DISBURSED", "REPAID"].includes(status);
  const rejected = status === "REJECTED";
  return (
    <span
      className={cn(
        "inline-flex rounded px-2.5 py-1 text-xs font-medium",
        approved && "bg-green-50 text-green-700",
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
      <span className="text-[#999]">
        {before === null ? "—" : formatCurrency(before)}
      </span>
      <span className="px-1.5">→</span>
      <strong className="font-medium text-foreground">
        {after === null ? "—" : formatCurrency(after)}
      </strong>
    </div>
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
      <span className="text-[#999]">{before ?? "—"}</span>
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
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4 border-b border-[#eee] py-3 text-sm">
      <span className="text-[#777]">{label}</span>
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
          <Eye className="size-3.5" /> View
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-[#eee] px-5 py-5">
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
    <div className="flex items-center justify-between border-t border-[#eee] px-4 py-4 text-xs text-[#777] sm:px-5">
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
            <TableHead>Top-up Principal</TableHead>
            <TableHead>New Outstanding</TableHead>
            <TableHead>Tenure</TableHead>
            <TableHead>Monthly Deduction</TableHead>
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
                  {row.assetName ? `Asset · ${row.assetName}` : "Cash"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.principal === null
                    ? "Set at approval"
                    : formatCurrency(row.principal)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.consolidatedOutstanding === null
                    ? "—"
                    : formatCurrency(row.consolidatedOutstanding)}
                </TableCell>
                <TableCell>
                  <TermChange before={row.termBefore} after={row.termAfter} />
                </TableCell>
                <TableCell>
                  <MoneyChange
                    before={row.monthlyBefore}
                    after={row.monthlyAfter}
                  />
                </TableCell>
                <TableCell>
                  <ChangeStatus status={row.status} />
                </TableCell>
                <TableCell className="text-right">
                  <DetailSheet
                    title={`Top-up ${row.id}`}
                    description="The complete before-and-after consolidation record."
                  >
                    <DetailItem
                      label="Loan ID"
                      value={row.loanId ?? "Created after approval"}
                    />
                    <DetailItem
                      label="Repayment record"
                      value={row.obligationId ?? "Linked at disbursement"}
                    />
                    <DetailItem
                      label="Type"
                      value={
                        row.assetName
                          ? `Asset purchase · ${row.assetName}`
                          : "Cash"
                      }
                    />
                    <DetailItem
                      label="Requested"
                      value={format(
                        new Date(row.requestedAt),
                        "d MMM yyyy, h:mm a",
                      )}
                    />
                    <DetailItem
                      label="Requested by"
                      value={
                        row.requestedByName ??
                        row.requestedById ??
                        "Not recorded"
                      }
                    />
                    <DetailItem
                      label="Decision/applied by"
                      value={
                        row.decidedByName ??
                        row.decidedById ??
                        "Not yet decided"
                      }
                    />
                    <DetailItem
                      label="Principal"
                      value={
                        row.principal === null
                          ? "Not set"
                          : formatCurrency(row.principal)
                      }
                    />
                    <DetailItem
                      label="Repayable amount added"
                      value={
                        row.amountAdded === null
                          ? "Not calculated yet"
                          : formatCurrency(row.amountAdded)
                      }
                    />
                    <DetailItem
                      label="Contractual balance before"
                      value={
                        row.contractualBefore === null
                          ? "—"
                          : formatCurrency(row.contractualBefore)
                      }
                    />
                    <DetailItem
                      label="Penalty balance before"
                      value={
                        row.penaltyBefore === null
                          ? "—"
                          : formatCurrency(row.penaltyBefore)
                      }
                    />
                    <DetailItem
                      label="New consolidated balance"
                      value={
                        row.consolidatedOutstanding === null
                          ? "Calculated at disbursement"
                          : formatCurrency(row.consolidatedOutstanding)
                      }
                    />
                    <DetailItem
                      label="Customer selected tenure"
                      value={
                        row.selectedTerm === null
                          ? "Not set"
                          : `${row.selectedTerm} months`
                      }
                    />
                    <DetailItem
                      label="Tenure used"
                      value={
                        <TermChange
                          before={row.termBefore}
                          after={row.termAfter}
                        />
                      }
                    />
                    <DetailItem
                      label="Monthly deduction"
                      value={
                        <MoneyChange
                          before={row.monthlyBefore}
                          after={row.monthlyAfter}
                        />
                      }
                    />
                    <DetailItem
                      label="Starts from"
                      value={
                        row.effectiveFrom
                          ? format(new Date(row.effectiveFrom), "MMMM yyyy")
                          : "After disbursement"
                      }
                    />
                    <DetailItem
                      label="Calculation record"
                      value={row.planId ?? "Not created yet"}
                    />
                    <DetailItem
                      label="Calculation policy"
                      value={row.policyVersion ?? "Not applied yet"}
                    />
                    <DetailItem
                      label="Verification hash"
                      value={row.planHash ?? "Not created yet"}
                    />
                  </DetailSheet>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={9}
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

function TenureTab({ customerId }: { customerId: string }) {
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
            <TableHead>Monthly Deduction</TableHead>
            <TableHead>Effective Month</TableHead>
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
                  {capitalize(row.reasonCode.replace(/_/g, " ").toLowerCase())}
                </TableCell>
                <TableCell>
                  <TermChange
                    before={row.previousTermMonths}
                    after={row.requestedTermMonths}
                  />
                </TableCell>
                <TableCell>
                  <MoneyChange
                    before={row.previousMonthly}
                    after={row.proposedMonthly}
                  />
                </TableCell>
                <TableCell>
                  {format(new Date(row.effectiveFromPeriod), "MMM yyyy")}
                </TableCell>
                <TableCell>
                  <ChangeStatus status={row.status} />
                </TableCell>
                <TableCell className="text-right">
                  <DetailSheet
                    title={`Tenure request ${row.id}`}
                    description="The requested repayment change and the calculation approved for it."
                  >
                    <DetailItem
                      label="Status"
                      value={<ChangeStatus status={row.status} />}
                    />
                    <DetailItem
                      label="Repayment record"
                      value={row.obligationId}
                    />
                    <DetailItem
                      label="Reason"
                      value={capitalize(
                        row.reasonCode.replace(/_/g, " ").toLowerCase(),
                      )}
                    />
                    <DetailItem
                      label="Note"
                      value={row.note ?? "No additional note"}
                    />
                    <DetailItem
                      label="Balance spread"
                      value={formatCurrency(row.balanceSnapshot)}
                    />
                    <DetailItem
                      label="Tenure"
                      value={
                        <TermChange
                          before={row.previousTermMonths}
                          after={row.requestedTermMonths}
                        />
                      }
                    />
                    <DetailItem
                      label="Monthly deduction"
                      value={
                        <MoneyChange
                          before={row.previousMonthly}
                          after={row.proposedMonthly}
                        />
                      }
                    />
                    <DetailItem
                      label="Starts from"
                      value={format(
                        new Date(row.effectiveFromPeriod),
                        "MMMM yyyy",
                      )}
                    />
                    <DetailItem
                      label="Requested by"
                      value={row.requestedByName ?? row.requestedBy}
                    />
                    <DetailItem
                      label="Decided by"
                      value={
                        row.approvedByName ??
                        row.rejectedByName ??
                        row.approvedBy ??
                        row.rejectedBy ??
                        "Pending decision"
                      }
                    />
                    <DetailItem
                      label="Decision date"
                      value={
                        row.decidedAt
                          ? format(
                              new Date(row.decidedAt),
                              "d MMM yyyy, h:mm a",
                            )
                          : "Pending decision"
                      }
                    />
                    <DetailItem
                      label="Verification hash"
                      value={row.previewHash}
                    />
                  </DetailSheet>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={8}
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const { data, isLoading } = useQuery(
    customerLoanStatement(customerId, {
      page,
      limit: PAGE_SIZE,
      ...(deferredSearch && { search: deferredSearch }),
    }),
  );
  const rows = data?.data ?? [];
  return (
    <>
      <div className="border-b border-[#eee] px-4 py-3 sm:px-5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute inset-y-0 left-3 my-auto size-4 text-[#999]" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search reference or activity"
            className="h-9 bg-[#fafafa] pl-9"
          />
        </div>
      </div>
      <Table className="min-w-[1000px] text-sm">
        <TableHeader>
          <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
            <TableHead>Date</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Charge / Addition</TableHead>
            <TableHead>Payment / Reduction</TableHead>
            <TableHead>Facility Balance After</TableHead>
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
                  {format(new Date(row.effectiveAt), "d MMM yyyy")}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {row.description}
                </TableCell>
                <TableCell>{row.reference}</TableCell>
                <TableCell className="tabular-nums">
                  {row.debit ? formatCurrency(row.debit) : "—"}
                </TableCell>
                <TableCell className="tabular-nums text-green-700">
                  {row.credit ? formatCurrency(row.credit) : "—"}
                </TableCell>
                <TableCell className="font-medium tabular-nums text-foreground">
                  {formatCurrency(row.totalBalance)}
                </TableCell>
                <TableCell className="text-right">
                  <DetailSheet
                    title={row.description}
                    description="Immutable account activity and resulting balance."
                  >
                    <DetailItem label="Reference" value={row.reference} />
                    <DetailItem
                      label="Repayment record"
                      value={row.obligationId}
                    />
                    <DetailItem
                      label="Effective date"
                      value={format(
                        new Date(row.effectiveAt),
                        "d MMM yyyy, h:mm a",
                      )}
                    />
                    <DetailItem
                      label="Recorded date"
                      value={format(
                        new Date(row.recordedAt),
                        "d MMM yyyy, h:mm a",
                      )}
                    />
                    <DetailItem label="Recorded by" value={row.actorName} />
                    <DetailItem
                      label="Contractual balance after"
                      value={formatCurrency(row.contractualBalance)}
                    />
                    <DetailItem
                      label="Penalty balance after"
                      value={formatCurrency(row.penaltyBalance)}
                    />
                    <DetailItem
                      label="Total balance after"
                      value={formatCurrency(row.totalBalance)}
                    />
                    <DetailItem
                      label="Calculation policy"
                      value={row.policyVersion ?? "Standard transaction"}
                    />
                    <DetailItem label="Event sequence" value={row.sequence} />
                    <DetailItem
                      label="Verification hash"
                      value={row.payloadHash}
                    />
                  </DetailSheet>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={7}
              title={
                isLoading
                  ? "Loading statement…"
                  : "No account activity recorded"
              }
              description="Disbursements, top-ups, repayments, penalties and approved changes will appear here."
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
    <div className="flex flex-col gap-3 border-b border-[#eee] px-4 py-3 sm:flex-row sm:px-5">
      <div className="relative w-full sm:w-72">
        <Search className="absolute inset-y-0 left-3 my-auto size-4 text-[#999]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search records"
          className="h-9 bg-[#fafafa] pl-9"
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

export default function LoanChanges({ customerId }: { customerId: string }) {
  return (
    <Card className="gap-0 overflow-hidden bg-background p-0">
      <div className="px-4 py-4 sm:px-5">
        <h2 className="font-semibold text-foreground">Loan Changes</h2>
        <p className="mt-1 text-xs text-[#777]">
          Top-ups, flexible-tenure decisions, and the complete account trail
          behind the current monthly deduction.
        </p>
      </div>
      <Separator className="bg-[#eee]" />
      <Tabs defaultValue="topups" className="gap-0">
        <div className="overflow-x-auto px-4 pt-3 sm:px-5">
          <TabsList className="w-full min-w-max justify-start bg-[#f5f5f5] sm:w-fit">
            <TabsTrigger value="topups">Top-ups</TabsTrigger>
            <TabsTrigger value="tenure">Tenure Changes</TabsTrigger>
            <TabsTrigger value="statement">Account Statement</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="topups">
          <TopupsTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="tenure">
          <TenureTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="statement">
          <StatementTab customerId={customerId} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
