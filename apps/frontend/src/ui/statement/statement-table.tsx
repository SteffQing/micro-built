"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { userStatement } from "@/lib/queries/user/statement";
import { exportStatement } from "@/lib/mutations/user/statement";
import { adminExportStatement } from "@/lib/mutations/admin/statement";
import { customerLoanStatement } from "@/lib/queries/admin/customer";
import PeriodRangeFilter, {
  type PeriodRangeValue,
} from "@/components/period-range-filter";
import { formatCurrency } from "@/lib/utils";
import { TableEmpty } from "@/ui/customer-id/empty-state";

const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  Summary bar                                                        */
/* ------------------------------------------------------------------ */

function SummaryBar({
  opening,
  debits,
  credits,
  closing,
}: {
  opening: number;
  debits: number;
  credits: number;
  closing: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
        <p className="text-[11px] font-medium text-muted-foreground">Opening Balance</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(opening)}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
        <p className="text-[11px] font-medium text-muted-foreground">Total Debits</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(debits)}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
        <p className="text-[11px] font-medium text-muted-foreground">Total Credits</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-success">
          {formatCurrency(credits)}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
        <p className="text-[11px] font-medium text-muted-foreground">Closing Balance</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(closing)}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Customer statement table                                           */
/* ------------------------------------------------------------------ */

export function CustomerStatementTable() {
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });

  const params = {
    page,
    limit: PAGE_SIZE,
    ...(period.from && { from: period.from }),
    ...(period.to && { to: period.to }),
  };

  const { data, isLoading } = useQuery(userStatement(params));
  const exportMut = useMutation(exportStatement);

  const statement = data?.data;
  const lines: StatementLineDto[] = statement?.lines ?? [];
  const total = data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
        <h2 className="text-lg font-semibold text-foreground">Statement</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            disabled={exportMut.isPending}
            onClick={() =>
              exportMut.mutate({
                ...(period.from && { from: period.from }),
                ...(period.to && { to: period.to }),
                format: "pdf",
              })
            }
          >
            <Icon icon={icons.download} size={14} /> Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            disabled={exportMut.isPending}
            onClick={() =>
              exportMut.mutate({
                ...(period.from && { from: period.from }),
                ...(period.to && { to: period.to }),
                format: "xlsx",
              })
            }
          >
            <Icon icon={icons.fileSpreadsheet} size={14} /> Export XLSX
          </Button>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden bg-background p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <PeriodRangeFilter value={period} onChange={setPeriod} />
        </div>

        {statement && (
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <SummaryBar
              opening={statement.opening}
              debits={statement.debits}
              credits={statement.credits}
              closing={statement.closing}
            />
          </div>
        )}

        <Table className="min-w-[800px] text-sm">
          <TableHeader>
            <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Debit</TableHead>
              <TableHead>Credit</TableHead>
              <TableHead>Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length ? (
              lines.map((row: StatementLineDto, i) => (
                <TableRow
                  key={`${row.date}-${row.reference}-${i}`}
                  className="[&>td]:px-3 [&>td]:py-3.5 [&>td:first-child]:pl-5 [&>td:last-child]:pr-5"
                >
                  <TableCell>
                    {format(new Date(row.date), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {row.description}
                  </TableCell>
                  <TableCell>{row.reference}</TableCell>
                  <TableCell className="tabular-nums">
                    {row.debit ? formatCurrency(row.debit) : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-success">
                    {row.credit ? formatCurrency(row.credit) : "—"}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums text-foreground">
                    {formatCurrency(row.balance)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty
                colSpan={6}
                title={isLoading ? "Loading statement…" : "No statement entries"}
                description="Account activity within the selected period will appear here."
              />
            )}
          </TableBody>
        </Table>

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-5">
            <span>
              {total} record{total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
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
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Admin statement table (for customer detail page)                    */
/* ------------------------------------------------------------------ */

export function AdminStatementTable({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });

  const params: CustomerLoanStatementQuery = {
    page,
    limit: PAGE_SIZE,
    ...(period.from && { from: period.from }),
    ...(period.to && { to: period.to }),
  };

  const { data, isLoading } = useQuery(
    customerLoanStatement(customerId, params),
  );
  const exportMut = useMutation(adminExportStatement(customerId));

  const statement = data?.data;
  const lines = (statement?.lines ?? []) as AdminStatementLineDto[];
  const total = data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <PeriodRangeFilter value={period} onChange={setPeriod} />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            disabled={exportMut.isPending}
            onClick={() =>
              exportMut.mutate({
                ...(period.from && { from: period.from }),
                ...(period.to && { to: period.to }),
                format: "pdf",
              })
            }
          >
            <Icon icon={icons.download} size={14} /> Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            disabled={exportMut.isPending}
            onClick={() =>
              exportMut.mutate({
                ...(period.from && { from: period.from }),
                ...(period.to && { to: period.to }),
                format: "xlsx",
              })
            }
          >
            <Icon icon={icons.fileSpreadsheet} size={14} /> Export XLSX
          </Button>
        </div>
      </div>

      {statement && (
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <SummaryBar
            opening={statement.opening}
            debits={statement.debits}
            credits={statement.credits}
            closing={statement.closing}
          />
        </div>
      )}

      <Table className="min-w-[1100px] text-sm">
        <TableHeader>
          <TableRow className="[&>th]:h-12 [&>th]:px-3 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Debit</TableHead>
            <TableHead>Credit</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Mgmt Fee</TableHead>
            <TableHead>Split (P / I / Pen)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length ? (
            lines.map((row: AdminStatementLineDto, i) => (
              <TableRow
                key={`${row.date}-${row.reference}-${i}`}
                className="[&>td]:px-3 [&>td]:py-3.5 [&>td:first-child]:pl-5 [&>td:last-child]:pr-5"
              >
                <TableCell>
                  {format(new Date(row.date), "d MMM yyyy")}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {row.description}
                </TableCell>
                <TableCell>{row.reference}</TableCell>
                <TableCell className="tabular-nums">
                  {row.debit ? formatCurrency(row.debit) : "—"}
                </TableCell>
                <TableCell className="tabular-nums text-success">
                  {row.credit ? formatCurrency(row.credit) : "—"}
                </TableCell>
                <TableCell className="font-medium tabular-nums text-foreground">
                  {formatCurrency(row.balance)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.managementFee ? formatCurrency(row.managementFee) : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-xs">
                  {row.split ? (
                    <span>
                      {formatCurrency(row.split.principal)} /{" "}
                      {formatCurrency(row.split.interest)} /{" "}
                      {formatCurrency(row.split.penalty)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty
              colSpan={8}
              title={isLoading ? "Loading statement…" : "No account activity recorded"}
              description="Disbursements, top-ups, repayments, penalties and approved changes will appear here."
            />
          )}
        </TableBody>
      </Table>

      {total > 0 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-5">
          <span>
            {total} record{total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
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
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
