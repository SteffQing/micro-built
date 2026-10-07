"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import PageTitle from "@/components/page-title";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLoanStatusColor } from "@/config/status";
import { marketerAssetRequests, marketerLoans, marketerTopups } from "@/lib/queries/marketer";
import { capitalize, formatCurrency } from "@/lib/utils";
import {
  PagedTableCard,
  StatusPill,
  customerCell,
  formatDate,
  useSearchState,
} from "@/ui/repayments/admin-repayments-view/paged-table-card";
import { EscalateDialog, escalatedAgo } from "./escalate-dialog";
import { ItemDetailsDialog } from "./item-details-dialog";

const words = (value: string) => capitalize(value.toLowerCase().replace(/_/g, " "));
const statusPill = (status: string) => (
  <StatusPill
    label={status === "IN_REVIEW" ? "In review" : words(status)}
    className={getLoanStatusColor((status === "IN_REVIEW" ? "PENDING" : status) as LoanStatus)}
  />
);

/** Details, and Escalate while it waits on an admin (with when it was last escalated). */
function actions(kind: EscalationKind, row: { id: string; customer: { name: string } } & EscalationState, what: string) {
  const ago = escalatedAgo(row.lastEscalatedAt);
  return (
    <div className="flex items-center justify-end gap-1.5">
      {row.stage && (
        <div className="flex flex-col items-end">
          <EscalateDialog
            kind={kind}
            id={row.id}
            stage={row.stage}
            lastEscalatedAt={row.lastEscalatedAt}
            what={`${row.customer.name}'s ${what}`}
          />
          {ago && <span className="mt-0.5 text-[11px] text-muted-foreground">Asked {ago}</span>}
        </div>
      )}
      <ItemDetailsDialog kind={kind} id={row.id} />
    </div>
  );
}

const waitingFor = (stage: EscalationStage | null) =>
  stage === "DECISION" ? "Approval" : stage === "DISBURSEMENT" ? "Disbursement" : "—";

const loanColumns: ColumnDef<MarketerCashLoanItemDto>[] = [
  { id: "customer", header: "Customer", cell: ({ row }) => customerCell(row.original.customer) },
  { id: "category", header: "Type", cell: ({ row }) => words(row.original.category) },
  {
    id: "principal",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-medium tabular-nums">{formatCurrency(row.original.principal)}</span>,
  },
  { id: "date", header: "Requested", cell: ({ row }) => formatDate(String(row.original.date)) },
  { id: "status", header: "Status", cell: ({ row }) => statusPill(row.original.status) },
  { id: "waiting", header: "Waiting for", cell: ({ row }) => waitingFor(row.original.stage) },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: "right" },
    cell: ({ row }) => actions("LOAN", row.original, `${words(row.original.category).toLowerCase()} loan`),
  },
];

const assetColumns: ColumnDef<MarketerAssetRequestItemDto>[] = [
  { id: "customer", header: "Customer", cell: ({ row }) => customerCell(row.original.customer) },
  { id: "name", header: "Asset", cell: ({ row }) => row.original.name },
  { id: "kind", header: "Kind", cell: ({ row }) => (row.original.kind === "TOPUP" ? "Top-up" : "New loan") },
  {
    id: "amount",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {row.original.amount === null ? "—" : formatCurrency(row.original.amount)}
      </span>
    ),
  },
  { id: "date", header: "Requested", cell: ({ row }) => formatDate(String(row.original.date)) },
  { id: "status", header: "Review", cell: ({ row }) => statusPill(row.original.status) },
  { id: "waiting", header: "Waiting for", cell: ({ row }) => waitingFor(row.original.stage) },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: "right" },
    cell: ({ row }) => actions("ASSET_REQUEST", row.original, `${row.original.name} request`),
  },
];

const topupColumns: ColumnDef<MarketerTopupItemDto>[] = [
  { id: "customer", header: "Customer", cell: ({ row }) => customerCell({ ...row.original.customer, externalId: null }) },
  { id: "kind", header: "For", cell: ({ row }) => row.original.asset?.name ?? "Cash" },
  {
    id: "amount",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {row.original.amount === null ? "—" : formatCurrency(row.original.amount)}
      </span>
    ),
  },
  { id: "date", header: "Requested", cell: ({ row }) => formatDate(row.original.requestedAt) },
  { id: "status", header: "Status", cell: ({ row }) => statusPill(row.original.status) },
  { id: "waiting", header: "Waiting for", cell: ({ row }) => waitingFor(row.original.stage) },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: "right" },
    cell: ({ row }) => actions("TOPUP", row.original, "top-up"),
  },
];

function StatusFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[160px] text-sm data-[size=default]:h-9" aria-label="Status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All statuses</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option === "IN_REVIEW" ? "In review" : words(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LoansTab() {
  const [search, setSearch, debounced] = useSearchState();
  const [status, setStatus] = useState("ALL");
  const params: CashLoanQuery = {
    ...(status !== "ALL" && { status: status as LoanStatus }),
    ...(debounced && { search: debounced }),
  };
  return (
    <PagedTableCard
      title="Loans"
      description="Your customers' cash loans, newest first"
      columns={loanColumns}
      useList={(page, limit) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useQuery({ ...marketerLoans({ ...params, page, limit }), placeholderData: (prev) => prev })
      }
      filterKey={JSON.stringify(params)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search customer, IPPIS ID or loan"
      filters={
        <StatusFilter
          value={status}
          onChange={setStatus}
          options={["PENDING", "APPROVED", "DISBURSED", "REPAID", "REJECTED"]}
        />
      }
      emptyTitle="No loans"
      emptyDescription="Your customers' loans show here."
    />
  );
}

function AssetsTab() {
  const [search, setSearch, debounced] = useSearchState();
  const [status, setStatus] = useState("ALL");
  const params: CommodityLoanQuery = {
    ...(status !== "ALL" && { status: status as CommodityRequestStatus }),
    ...(debounced && { search: debounced }),
  };
  return (
    <PagedTableCard
      title="Asset requests"
      description="New asset loans and asset top-ups, newest first"
      columns={assetColumns}
      useList={(page, limit) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useQuery({ ...marketerAssetRequests({ ...params, page, limit }), placeholderData: (prev) => prev })
      }
      filterKey={JSON.stringify(params)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search customer or IPPIS ID"
      filters={<StatusFilter value={status} onChange={setStatus} options={["IN_REVIEW", "APPROVED", "REJECTED"]} />}
      emptyTitle="No asset requests"
      emptyDescription="Your customers' asset requests show here."
    />
  );
}

function TopupsTab() {
  const [status, setStatus] = useState("ALL");
  const params = status !== "ALL" ? { status } : {};
  return (
    <PagedTableCard
      title="Top-ups"
      description="Top-ups on your customers' running loans, newest first"
      columns={topupColumns}
      useList={(page, limit) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useQuery({ ...marketerTopups({ ...params, page, limit }), placeholderData: (prev) => prev })
      }
      filterKey={JSON.stringify(params)}
      filters={
        <StatusFilter value={status} onChange={setStatus} options={["PENDING", "APPROVED", "DISBURSED", "REJECTED"]} />
      }
      emptyTitle="No top-ups"
      emptyDescription="Top-ups on your customers' loans show here."
    />
  );
}

/** A marketer's customers' loans, asset requests and top-ups: read-only, with Escalate on anything waiting. */
export function MarketerLoansPage() {
  return (
    <main className="space-y-3 p-3 lg:space-y-5 lg:p-5">
      <PageTitle title="Loans" />
      <Tabs defaultValue="loans">
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="assets">Asset requests</TabsTrigger>
            <TabsTrigger value="topups">Top-ups</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="loans" className="mt-4">
          <LoansTab />
        </TabsContent>
        <TabsContent value="assets" className="mt-4">
          <AssetsTab />
        </TabsContent>
        <TabsContent value="topups" className="mt-4">
          <TopupsTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}
