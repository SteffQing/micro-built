"use client";

import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { FilterDate } from "@/components/filters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    actions: [
      "PAYMENT_INFLOW_APPROVED",
      "PAYMENT_INFLOW_REJECTED",
      "VARIATION_GENERATED",
      "VOUCHER_UPLOADED",
      "VOUCHER_REVERTED",
      "NO_PAYROLL",
      "NO_PAYROLL_REVERTED",
      "ORGANIZATIONS_MERGED",
      "ORGANIZATION_CREATED",
      "ORGANIZATION_RENAMED",
      "ORGANIZATION_DELETED",
    ],
  },
  {
    label: "Customers",
    actions: [
      "CUSTOMER_ONBOARDED",
      "CUSTOMERS_IMPORTED",
      "CUSTOMER_STATUS_CHANGED",
      "CUSTOMER_OFFICER_CHANGED",
      "CHANGE_REQUEST_PROPOSED",
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
      "COMMODITY_DELETED",
      "ADMIN_INVITED",
      "ADMIN_ROLE_CHANGED",
      "ADMIN_REMOVED",
      "SIGN_IN_RESET",
      "DATA_EXPORTED",
    ],
  },
];

const ENTITY_LABELS: Record<AuditEntityType, string> = {
  LOAN: "Loan",
  MICRO_LOAN: "Top-up / charge",
  TENURE_CHANGE: "Tenure change",
  PAYMENT_INFLOW: "Payment",
  VARIATION: "Variation",
  VOUCHER: "Voucher",
  ORGANIZATION: "Organization",
  COMMODITY_LOAN: "Asset request",
  USER: "Person",
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
  if (
    action.endsWith("_REJECTED") ||
    action === "ADMIN_REMOVED" ||
    action === "ORGANIZATION_DELETED" ||
    action === "PENALTY_APPLIED" ||
    action === "SIGN_IN_RESET" ||
    action === "NO_PAYROLL" ||
    action.endsWith("_REVERTED")
  ) {
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

const keyLabel = (key: string) => humanize(key.replace(/([A-Z])/g, "_$1"));

/** Structured detail: before → after when there is one, otherwise each key and value. */
function Meta({ meta }: { meta: Record<string, unknown> }) {
  const before = meta.before as Record<string, unknown> | undefined;
  const after = meta.after as Record<string, unknown> | undefined;
  const rows: { key: string; value: ReactNode }[] =
    before && after
      ? Object.keys(after).map((key) => ({
          key,
          value: (
            <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5">
              <span className="text-muted-foreground line-through">{showValue(key, before[key])}</span>
              <Icon icon={icons.arrowRight} size={12} className="text-muted-foreground" />
              <span className="font-medium">{showValue(key, after[key])}</span>
            </span>
          ),
        }))
      : Object.entries(
          meta.filters && typeof meta.filters === "object" ? { ...meta, ...(meta.filters as object) } : meta,
        )
          .filter(([key, value]) => key !== "filters" && value !== null && value !== "")
          .map(([key, value]) => ({ key, value: <span className="font-medium">{showValue(key, value)}</span> }));
  return (
    <dl className="divide-y rounded-lg border">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2 text-sm">
          <dt className="text-muted-foreground">{keyLabel(row.key)}</dt>
          <dd className="min-w-0 text-right wrap-anywhere">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function About({ row, bare = false }: { row: AuditEntryDto; bare?: boolean }) {
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
      {bare ? (
        row.entityLabel &&
        row.entityType !== "USER" && <p className="text-xs text-muted-foreground wrap-anywhere">{row.entityId}</p>
      ) : (
        <p className="text-xs text-muted-foreground wrap-anywhere">
          {ENTITY_LABELS[row.entityType]}
          {row.entityLabel && row.entityType !== "USER" && ` · ${row.entityId}`}
        </p>
      )}
    </div>
  );
}

const ActionPill = ({ action }: { action: AuditAction }) => (
  <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", actionTone(action))}>
    {humanize(action)}
  </span>
);

const TONE_TILE: Record<string, string> = {
  "bg-destructive/10 text-destructive": "bg-destructive/10 text-destructive",
  "bg-success/10 text-success": "bg-success/10 text-success",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

/** One entry in full: who did what, when, to which record, with the note and the recorded details. */
function AuditEntryModal({ row }: { row: AuditEntryDto }) {
  const tone = TONE_TILE[actionTone(row.action)] ?? "bg-primary/10 text-primary";
  const hasMeta = row.meta && Object.keys(row.meta).length > 0;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Icon icon={icons.view} size={12} className="mr-1" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-lg sm:max-w-[480px]">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
              <Icon icon={icons.shield} size={18} />
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle>{humanize(row.action)}</DialogTitle>
              <DialogDescription>{format(new Date(row.createdAt), "EEE d MMM yyyy, h:mm a")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={cn(dialogBodyClass, "min-w-0 pt-4")}>
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/40 p-3">
            <Fact label="By">
              <p className="truncate font-medium">{row.actor.name}</p>
              <p className="text-xs text-muted-foreground">{humanize(row.actor.role)}</p>
            </Fact>
            <Fact label={ENTITY_LABELS[row.entityType]}>
              <About row={row} bare />
            </Fact>
          </div>

          <section className="grid gap-1.5">
            <h3 className="text-xs font-medium text-muted-foreground">Note</h3>
            {row.note ? (
              <p className="rounded-lg border-l-2 border-primary/40 bg-muted/30 px-3 py-2 text-sm wrap-anywhere">{row.note}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No note was recorded.</p>
            )}
          </section>

          {hasMeta && (
            <section className="grid gap-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">Details</h3>
              <Meta meta={row.meta!} />
            </section>
          )}
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
          {/* Two by two on phones; one row of fixed widths from sm up. */}
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9 w-full min-w-0 text-sm data-[size=default]:h-9 sm:w-[190px]" aria-label="Action">
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
            <SelectTrigger className="h-9 w-full min-w-0 text-sm data-[size=default]:h-9 sm:w-[160px]" aria-label="Record">
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
            <SelectTrigger className="h-9 w-full min-w-0 text-sm data-[size=default]:h-9 sm:w-[160px]" aria-label="Admin">
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
          <FilterDate
            className="min-w-0 sm:w-auto"
            triggerClassName="h-9 w-full min-w-0 overflow-hidden text-sm sm:w-auto sm:min-w-[200px]"
            placeholder="Any date"
            value={{ start: from ? parseISO(from) : undefined, end: to ? parseISO(to) : undefined }}
            onChange={({ start, end }) => {
              setFrom(start ? format(start, "yyyy-MM-dd") : "");
              setTo(end ? format(end, "yyyy-MM-dd") : "");
            }}
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
