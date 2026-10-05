"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminAuditLog } from "@/lib/queries/admin/change-requests";
import { adminUsers } from "@/lib/queries/admin/superadmin";
import { capitalize, cn } from "@/lib/utils";

const PAGE_SIZE = 25;

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
    actions: ["PAYMENT_INFLOW_APPROVED", "PAYMENT_INFLOW_REJECTED", "PAYROLL_UPLOADED", "VARIATION_SUBMITTED", "PERIOD_CLOSED"],
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
          <div key={key} className="grid grid-cols-[12rem_1fr] gap-3">
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
        <div key={key} className="grid grid-cols-[12rem_1fr] gap-3">
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
      <div className="text-xs text-muted-foreground">{ENTITY_LABELS[row.entityType]}</div>
      {customerPage ? (
        <Link href={`/customers/${row.entityId}`} className="font-medium hover:underline wrap-anywhere">
          {label}
        </Link>
      ) : (
        <span className="font-medium wrap-anywhere">{label}</span>
      )}
      {row.entityLabel && row.entityType !== "USER" && (
        <div className="text-xs text-muted-foreground wrap-anywhere">{row.entityId}</div>
      )}
    </div>
  );
}

export default function AuditLogTable() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [actorId, setActorId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const admins = useQuery(adminUsers);

  const { data, isLoading, isError, error } = useQuery(
    adminAuditLog({
      page,
      limit: PAGE_SIZE,
      ...(action !== "all" && { action: action as AuditAction }),
      ...(entityType !== "all" && { entityType: entityType as AuditEntityType }),
      ...(actorId !== "all" && { actorId }),
      ...(from && { from }),
      ...(to && { to }),
    }),
  );
  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = action !== "all" || entityType !== "all" || actorId !== "all" || from || to;

  const reset = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };
  function clear() {
    setAction("all");
    setEntityType("all");
    setActorId("all");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Every admin decision and change, newest first. Times are Lagos time.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="audit-action">Action</Label>
            <Select value={action} onValueChange={reset(setAction)}>
              <SelectTrigger id="audit-action" className="h-9 w-full">
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-entity">Record</Label>
            <Select value={entityType} onValueChange={reset(setEntityType)}>
              <SelectTrigger id="audit-entity" className="h-9 w-full">
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-actor">Admin</Label>
            <Select value={actorId} onValueChange={reset(setActorId)}>
              <SelectTrigger id="audit-actor" className="h-9 w-full">
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-from">From</Label>
            <Input id="audit-from" type="date" className="h-9" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to">To</Label>
            <Input id="audit-to" type="date" className="h-9" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} />
          </div>
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <Icon icon={icons.x} size={14} /> Clear filters
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[960px] text-sm">
          <TableHeader>
            <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>About</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <Icon icon={icons.loaderCircle} size={24} className="mx-auto animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-destructive">
                  {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                    "The audit log could not be loaded"}
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const expanded = open === row.id;
                return (
                  <Fragment key={row.id}>
                    <TableRow className="[&>td]:px-3 [&>td]:py-3 [&>td:first-child]:pl-5 [&>td:last-child]:pr-5 align-top">
                      <TableCell className="whitespace-nowrap tabular-nums">
                        <div>{format(new Date(row.createdAt), "d MMM yyyy")}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(row.createdAt), "h:mm a")}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.actor.name}</div>
                        <div className="text-xs text-muted-foreground">{humanize(row.actor.role)}</div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", actionTone(row.action))}>
                          {humanize(row.action)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <About row={row} />
                      </TableCell>
                      <TableCell className="max-w-[22rem] text-muted-foreground wrap-anywhere">{row.note ?? "—"}</TableCell>
                      <TableCell>
                        {row.meta && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-expanded={expanded}
                            aria-label={expanded ? "Hide details" : "Show details"}
                            onClick={() => setOpen(expanded ? null : row.id)}
                          >
                            <Icon icon={expanded ? icons.chevronUp : icons.chevronDown} size={16} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expanded && row.meta && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="px-5 py-4">
                          <Meta meta={row.meta} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                  {filtered ? "Nothing matches these filters" : "Nothing has been recorded yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-5">
          <span>
            {total} entr{total === 1 ? "y" : "ies"}
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
