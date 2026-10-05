"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon, icons } from "@/components/icon";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";
import { adminExportReport } from "@/lib/mutations/admin/statement";
import { customerReportPreview } from "@/lib/queries/admin/customer";
import { cn, formatCurrency } from "@/lib/utils";
import { DisabledHint } from "@/components/disabled-hint";
import { visibleEmail } from "@microbuilt/shared";

type Format = "pdf" | "xlsx";
type Audience = "customer" | "admin";

/** A two-or-more option pill switch, the same look as the Inflows source filter. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-9 items-center rounded-lg bg-muted p-0.5 text-xs font-medium">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className="h-full rounded-md px-3 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground", className)}>{value}</p>
    </div>
  );
}

function Panel({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** What the admin copy of the report holds: statement summary, revenue and the account officer. */
function ReportPreview({ customerId, period }: { customerId: string; period: PeriodRangeValue }) {
  const { data, isLoading } = useQuery(
    customerReportPreview(customerId, {
      audience: "admin",
      ...(period.from && { from: period.from }),
      ...(period.to && { to: period.to }),
    }),
  );
  const report = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!report) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No report data for this period.</p>;
  }

  return (
    <div className="space-y-3">
      <Panel title="Statement summary" aside={`${report.range.fromLabel} – ${report.range.toLabel}`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="Opening" value={formatCurrency(report.statement.opening)} />
          <Figure label="Debits" value={formatCurrency(report.statement.debits)} />
          <Figure label="Credits" value={formatCurrency(report.statement.credits)} className="text-success" />
          <Figure label="Closing" value={formatCurrency(report.statement.closing)} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
          <Figure label="Repaid" value={formatCurrency(report.totals.repaid)} />
          <Figure label="Outstanding" value={formatCurrency(report.totals.outstanding)} />
          <Figure label="Repayment rate" value={`${report.totals.repaymentRate.toFixed(1)}%`} />
          <Figure label="Active loans" value={report.loans.length.toString()} />
        </div>
      </Panel>

      {report.revenue && (
        <Panel title="Revenue">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Figure label="Interest booked" value={formatCurrency(report.revenue.interestBooked)} />
            <Figure label="Interest collected" value={formatCurrency(report.revenue.interestCollected)} />
            <Figure label="Management fee" value={formatCurrency(report.revenue.managementFee)} />
            <Figure label="Penalty charged" value={formatCurrency(report.revenue.penaltyCharged)} />
            <Figure label="Penalty collected" value={formatCurrency(report.revenue.penaltyCollected)} />
          </div>
        </Panel>
      )}

      <Panel title="Account officer">
        <p className="text-sm font-medium text-foreground wrap-anywhere">
          {report.accountOfficer?.name ?? "Not assigned"}
        </p>
      </Panel>
    </div>
  );
}

/**
 * `email` is the customer's address; a phone-only customer has none (or a placeholder), so their copy can't be
 * sent to them and that button is disabled.
 */
export default function GenerateCustomerLoanReport({ id, email }: { id: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });
  const [format, setFormat] = useState<Format>("pdf");
  // Only for the internal copy: a customer copy is always protected with the customer ID.
  const [protect, setProtect] = useState(false);
  const customerEmail = visibleEmail(email);

  const report = useMutation(adminExportReport(id));

  const generate = (audience: Audience) =>
    report.mutate({
      audience,
      format,
      protect,
      // The customer's copy is emailed to them; the admin's to the requesting admin (the API's default).
      ...(audience === "customer" && customerEmail && { email: customerEmail }),
      ...(period.from && { from: period.from }),
      ...(period.to && { to: period.to }),
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Icon icon={icons.file} size={16} />
          Generate Report
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] grid-cols-1 gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="border-b">
          <DialogTitle>Customer report</DialogTitle>
          <DialogDescription>
            A summary of the customer&apos;s loans with their full statement. Preview the figures, then generate the
            file; the download link also arrives in-app.
          </DialogDescription>
        </DialogHeader>

        <div className={cn(dialogBodyClass, "min-w-0 pt-4")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Preview</p>
            <PeriodRangeFilter value={period} onChange={setPeriod} />
          </div>

          <div className="min-w-0">
            <ReportPreview customerId={id} period={period} />
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Checkbox id="protect-report" checked={protect} onCheckedChange={(v) => setProtect(v === true)} />
                <Label htmlFor="protect-report" className="text-sm font-normal leading-snug">
                  Password-protect the admin copy
                  <span className="block text-xs text-muted-foreground">
                    Customer copies always are. Both open with the customer ID ({id})
                  </span>
                </Label>
              </div>
              <Segmented
                label="File format"
                value={format}
                onChange={setFormat}
                options={[
                  { value: "pdf", label: "PDF" },
                  { value: "xlsx", label: "Excel" },
                ]}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DisabledHint reason={customerEmail ? null : "This customer has no email address to send their copy to"}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={report.isPending || !customerEmail}
                  onClick={() => generate("customer")}
                >
                  <Icon icon={icons.mail} size={16} />
                  Send to customer
                </Button>
              </DisabledHint>
              <Button type="button" disabled={report.isPending} onClick={() => generate("admin")}>
                <Icon icon={icons.shield} size={16} />
                Generate for admin review
              </Button>
            </div>
            {customerEmail && (
              <p className="text-right text-xs text-muted-foreground">
                The customer&apos;s copy goes to <span className="font-medium text-foreground wrap-anywhere">{customerEmail}</span>.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
