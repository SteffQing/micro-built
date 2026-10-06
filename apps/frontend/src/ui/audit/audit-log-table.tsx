"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { adminAuditLog } from "@/lib/queries/admin/change-requests";
import { PagedTableCard } from "@/ui/repayments/admin-repayments-view/paged-table-card";
import { adminUsers } from "@/lib/queries/admin/superadmin";
import { capitalize, cn } from "@/lib/utils";

// Grouped as admins think of them, not as the enum lists them.
const ACTION_GROUPS: { label: string; actions: AuditAction[] }[] = [
  {
    label: "Loans",
    actions: [
      "LOAN_APPROVED",
      "LOAN_REJECTED",
      "LOAN_DISBURSED",
      "TOPUP_APPROVED",
      "TOPUP_REJECTED",
      "TOPUP_DISBURSED",
      "COMMODITY_APPROVED",
      "COMMODITY_REJECTED",
      "TENURE_CHANGE_PROPOSED",
      "TENURE_CHANGE_APPROVED",
      "TENURE_CHANGE_REJECTED",
      "PENALTY_APPLIED",
    ],
  },
  {
    label: "Payments & payroll",
    actions: ["PAYMENT_INFLOW_APPROVED", "PAYMENT_INFLOW_REJECTED", "PAYROLL_UPLOADED", "VARIATION_SUBMITTED", "VARIATION_REVERTED", "PERIOD_CLOSED"],
  },
  {
    label: "Customers",
    actions: [
      "CUSTOMER_ONBOARDED",
      "CUSTOMERS_IMPORTED",
      "CUSTOMER_STATUS_CHANGED",
      "CUSTOMER_OFFICER_CHANGED",
      "CHANGE_REQUEST_APPROVED",
      "CHANGE_REQUEST_REJECTED",
      "DOCUMENT_GENERATED",
    ],
  },
  {
    label: "Platform",
    actions: [
      "SETTINGS_UPDATED",
      "MAINTENANCE_TOGGLED",
      "COMMODITY_ADDED",
      "COMMODITY_UPDATED",
      "ADMIN_INVITED",
      "ADMIN_REMOVED",
      "DATA_EXPORTED",
    ],
  },
];

const ENTITY_LABELS: Record<AuditEntityType, string> = {
  LOAN: "Loan",
  MICRO_LOAN: "Top-up / charge",
  TENURE_CHANGE: "Tenure change",
  PAYMENT_INFLOW: "Payment",
  PAYROLL_PERIOD: "Payroll month",
  COMMODITY_LOAN: "Asset request",
  USER: "Person",
  PAYROLL_UPLOAD: "Payroll upload",
  CHANGE_REQUEST: "Change request",
  SETTINGS: "Settings",
  COMMODITY: "Commodity",
  FILE: "File",
};

// Rates are stored as fractions; the settings screen shows percentages.
const RATE_KEYS = new Set(["interestRate", "managementFeeRate", "penaltyRate", "maxDeductionRate"]);

function humanize(value: string) {
  return capitalize(value.replace(/_/g, " ").toLowerCase());
}

function actionTone(action: AuditAction) {
  if (action.endsWith("_REJECTED") || action === "ADMIN_REMOVED" || action === "PENALTY_APPLIED") {
    return "bg-destructive/10 text-destructive";
  }
  if (action.endsWith("_APPROVED") || action.endsWith("_DISBURSED") || action === "CUSTOMER_ONBOARDED") {
    return "bg-success/10 text-success";
  }
  return "bg-muted text-foreground";
}

function showValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "not set";
  if (RATE_KEYS.has(key) && typeof value === "number") return `${+(value * 100).toFixed(4)}%`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Structured detail: a before/after table when there is one, otherwise each key and value. */
function Meta({ meta }: { meta: Record<string, unknown> }) {
  const before = meta.before as Record<string, unknown> | undefined;
  const after = meta.after as Record<string, unknown> | undefined;
  if (before && after) {
    return (
      <dl className="grid gap-1.5 text-sm">
        {Object.keys(after).map((key) => (
          <div key={key} className="grid grid-cols-1 gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
            <dt className="text-muted-foreground">{humanize(key.replace(/([A-Z])/g, "_$1"))}</dt>
            <dd>
              <span className="text-muted-foreground line-through">{showValue(key, before[key])}</span>
              <span aria-hidden className="px-1.5 text-muted-foreground">→</span>
              <strong className="font-medium">{showValue(key, after[key])}</strong>
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  const flat = Object.entries(meta.filters && typeof meta.filters === "object" ? { ...meta, ...(meta.filters as object) } : meta)
    .filter(([key, value]) => key !== "filters" && value !== null && value !== "");
  return (
    <dl className="grid gap-1.5 text-sm">
      {flat.map(([key, value]) => (
        <div key={key} className="grid grid-cols-1 gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
          <dt className="text-muted-foreground">{humanize(key.replace(/([A-Z])/g, "_$1"))}</dt>
          <dd className="wrap-anywhere">{showValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function About({ row }: { row: AuditEntryDto }) {
  const label = row.entityLabel ?? row.entityId;
  const customerPage = row.entityType === "USER" && row.entityId.startsWith("MB-");
  return (
    <div className="min-w-0">
      {customerPage ? (
        <Link href={`/customers/${row.entityId}`} className="font-medium hover:underline wrap-anywhere">
          {label}
        </Link>
      ) : (
        <p className="font-medium wrap-anywhere">{label}</p>
      )}
      <p className="text-xs text-muted-foreground wrap-anywhere">
        {ENTITY_LABELS[row.entityType]}
        {row.entityLabel && row.entityType !== "USER" && ` · ${row.entityId}`}
      </p>
    </div>
  );
}

const ActionPill = ({ action }: { action: AuditAction }) => (
  <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", actionTone(action))}>
    {humanize(action)}
  </span>
);

/** One entry in full: who, when, what it was about, the note and the recorded details. */
function AuditEntryModal({ row }: { row: AuditEntryDto }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Icon icon={icons.view} size={12} className="mr-1" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{humanize(row.action)}</DialogTitle>
          <DialogDescription>
            {row.actor.name} · {format(new Date(row.createdAt), "d MMM yyyy, h:mm a")}
          </DialogDescription>
        </DialogHeader>
        <Separator className="bg-border" />
        <div className={`${dialogBodyClass} min-w-0 pt-4`}>
          <div className="flex items-start justify-between gap-3">
            <About row={row} />
            <ActionPill action={row.action} />
          </div>
          <section className="space-y-1.5">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Note</h3>
            <p className="text-sm wrap-anywhere">{row.note ?? <span className="text-muted-foreground">No note</span>}</p>
          </section>
          {row.meta && Object.keys(row.meta).length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Details</h3>
              <div className="rounded-lg border px-3 py-2.5">
                <Meta meta={row.meta} />
              </div>
            </section>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 bg-muted text-sm font-medium text-muted-foreground"
            >
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const columns: ColumnDef<AuditEntryDto>[] = [
  {
    id: "when",
    header: "When",
    cell: ({ row }) => (
      <div className="whitespace-nowrap tabular-nums">
        <p>{format(new Date(row.original.createdAt), "d MMM yyyy")}</p>
        <p className="text-xs text-muted-foreground">{format(new Date(row.original.createdAt), "h:mm a")}</p>
      </div>
    ),
  },
  {
    id: "who",
    header: "Who",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.actor.name}</p>
        <p className="text-xs text-muted-foreground">{humanize(row.original.actor.role)}</p>
      </div>
    ),
  },
  { id: "action", header: "Action", cell: ({ row }) => <ActionPill action={row.original.action} /> },
  { id: "about", header: "About", cell: ({ row }) => <About row={row.original} /> },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: "right" },
    cell: ({ row }) => <AuditEntryModal row={row.original} />,
  },
];

export default function AuditLogTable() {
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [actorId, setActorId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const admins = useQuery(adminUsers);

  const params: AuditQuery = {
    ...(action !== "all" && { action: action as AuditAction }),
    ...(entityType !== "all" && { entityType: entityType as AuditEntityType }),
    ...(actorId !== "all" && { actorId }),
    ...(from && { from }),
    ...(to && { to }),
  };
  const filtered = Object.keys(params).length > 0;

  function clear() {
    setAction("all");
    setEntityType("all");
    setActorId("all");
    setFrom("");
    setTo("");
  }

  return (
    <PagedTableCard
      title="Activity"
      description="Every admin decision and change, newest first. Times are Lagos time."
      columns={columns}
      useList={(page, limit) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useQuery({ ...adminAuditLog({ ...params, page, limit }), placeholderData: (prev) => prev })
      }
      filterKey={JSON.stringify(params)}
      filters={
        <>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9 w-[190px] text-sm" aria-label="Action">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTION_GROUPS.map((group) => (
                <Fragment key={group.label}>
                  <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</div>
                  {group.actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {humanize(a)}
                    </SelectItem>
                  ))}
                </Fragment>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="h-9 w-[160px] text-sm" aria-label="Record">
              <SelectValue placeholder="All records" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All records</SelectItem>
              {(Object.keys(ENTITY_LABELS) as AuditEntityType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {ENTITY_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actorId} onValueChange={setActorId}>
            <SelectTrigger className="h-9 w-[160px] text-sm" aria-label="Admin">
              <SelectValue placeholder="Everyone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="system">System (automatic)</SelectItem>
              {(admins.data?.data ?? []).map((admin) => (
                <SelectItem key={admin.id} value={admin.id}>
                  {admin.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              aria-label="From"
              className="h-9 w-[140px] text-sm"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="To"
              className="h-9 w-[140px] text-sm"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {filtered && (
            <Button variant="ghost" size="sm" className="h-9" onClick={clear}>
              <Icon icon={icons.x} size={14} /> Clear
            </Button>
          )}
        </>
      }
      emptyTitle={filtered ? "Nothing matches these filters" : "Nothing recorded yet"}
      emptyDescription={filtered ? "Try a wider date range or another action." : "Admin decisions and changes appear here."}
    />
  );
}
