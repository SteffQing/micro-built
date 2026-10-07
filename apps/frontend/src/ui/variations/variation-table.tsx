"use client";

import { useMemo, useState } from "react";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VariationAction, VariationReason, VariationRow } from "@/lib/payroll/variations";
import { cn, formatCurrency } from "@/lib/utils";

export const actionLabels: Record<VariationAction, string> = {
  START: "Start",
  AMEND: "Amend",
  STOP: "Stop",
};

export const actionHints: Record<VariationAction, string> = {
  START: "New deductions",
  AMEND: "Changed amounts",
  STOP: "Deductions to end",
};

export const actionTone: Record<VariationAction, string> = {
  START: "bg-success/12 text-success",
  AMEND: "bg-warning/12 text-warning",
  STOP: "bg-destructive/12 text-destructive",
};

export const reasonLabels: Record<VariationReason, string> = {
  NEW_LOAN: "New loan",
  TOPUP: "Top-up",
  LIQUIDATION: "Liquidation",
  TENURE_CHANGE: "Tenure change",
  DEFAULT: "Missed payment",
};

const PAGE = 50;

export function VariationRowsSkeleton() {
  return (
    <div className="divide-y rounded-xl border" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * One line per loan whose deduction changes: who, what payroll must do, why, the amount and the months it runs.
 * The rows arrive filtered by action and reason; the search box narrows them further in the browser.
 */
export function VariationTable({ rows }: { rows: VariationRow[] }) {
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);

  const matching = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.name, row.externalId, row.command, row.loanId].some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [rows, search]);
  const visible = matching.slice(0, shown);

  return (
    <div className="grid gap-3">
      <div className="relative max-w-sm">
        <Icon
          icon={icons.search}
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search name, IPPIS ID or command"
          aria-label="Search the variation"
          className="h-9 pl-9"
        />
      </div>

      {matching.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">{rows.length === 0 ? "No changes for this selection" : "Nobody matches that search"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {rows.length === 0
              ? "Customers who aren't listed keep their current deductions."
              : "Try a name, an IPPIS ID or a command."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Change</TableHead>
                <TableHead className="text-right">Monthly deduction</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Months</TableHead>
                <TableHead>Runs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.loanId}>
                  <TableCell className="min-w-44">
                    <p className="max-w-56 truncate font-medium">{row.name}</p>
                    <p className="max-w-56 truncate text-xs text-muted-foreground">
                      {row.externalId ?? "No IPPIS"}
                      {row.command ? ` · ${row.command}` : ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", actionTone[row.action])}>
                        {actionLabels[row.action]}
                      </span>
                      {row.reasons.map((reason) => (
                        <span key={reason} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {reasonLabels[reason]}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {row.action === "STOP" ? "—" : formatCurrency(row.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(row.balance)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{row.tenure}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {row.action === "STOP" ? `Stop from ${row.start}` : `${row.start} – ${row.end}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {matching.length > visible.length && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Showing {visible.length} of {matching.length} loans
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, matching.length - visible.length)} more
          </Button>
        </div>
      )}
    </div>
  );
}
