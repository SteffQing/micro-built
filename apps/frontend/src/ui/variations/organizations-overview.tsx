"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentLagosMonth, monthTitle, type GenerateVariationsResult } from "@/lib/payroll/variations";
import { organizationsList } from "@/lib/queries/admin/organizations";
import { cn } from "@/lib/utils";
import { errorMessage } from "./errors";
import { whenLabel } from "./format";
import { GenerateDialog, GenerateResult } from "./generate-dialog";

type Tone = "success" | "warning" | "muted";

const toneClass: Record<Tone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  muted: "border-border bg-muted text-muted-foreground",
};

/** What one organization's selected month looks like from the list alone (the page behind it has the detail). */
function monthState(organization: OrganizationDto, period: string, thisMonth: string) {
  const unlocked = organization.unlocked.find((item) => item.ym === period);
  if (unlocked) {
    return {
      tone: "success" as Tone,
      label: `Generated · v${unlocked.version}`,
      note: `Last generated ${whenLabel(unlocked.updatedAt)}`,
      regenerate: unlocked.regenerateHint,
    };
  }
  if (organization.latestLocked && period <= organization.latestLocked.ym) {
    return {
      tone: "muted" as Tone,
      label: period === organization.latestLocked.ym ? "Locked" : "Settled",
      note: "Voucher in, or no deductions that month",
      regenerate: false,
    };
  }
  if (period === thisMonth) {
    return organization.deductionsThisMonth
      ? { tone: "warning" as Tone, label: "To generate", note: "Has deductions this month", regenerate: false }
      : { tone: "muted" as Tone, label: "Skipped", note: "No deductions this month", regenerate: false };
  }
  return { tone: "muted" as Tone, label: "Not generated", note: "Open it to preview", regenerate: false };
}

/** Every organization at a glance for one month, and "generate for all". Opening a row shows its variation. */
export function OrganizationsOverview({
  period,
  superAdmin,
  onOpen,
}: {
  /** YYYY-MM */
  period: string;
  superAdmin: boolean;
  onOpen: (organizationId: string) => void;
}) {
  const { data, isLoading, isError, error } = useQuery(organizationsList);
  const [result, setResult] = useState<GenerateVariationsResult | null>(null);
  const organizations = data?.data ?? [];
  const thisMonth = currentLagosMonth();
  const label = monthTitle(period);

  return (
    <div className="grid min-w-0 gap-4">
      {result && <GenerateResult result={result} onDismiss={() => setResult(null)} />}

      <section className="min-w-0 rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">All organizations · {label}</h2>
            <p className="text-xs text-muted-foreground">
              Each organization has its own variation, generated as often as needed until its voucher locks it.
              Organizations with no deductions for the month are skipped.
            </p>
          </div>
          {superAdmin && (
            <GenerateDialog
              period={period}
              periodLabel={label}
              organization={null}
              onQueued={setResult}
              trigger={
                <Button type="button" disabled={isLoading || organizations.length === 0}>
                  <Icon icon={icons.fileSpreadsheet} size={16} />
                  Generate for all
                </Button>
              }
            />
          )}
        </div>

        {isError ? (
          <p role="alert" className="border-t p-4 text-sm text-destructive sm:px-5">
            {errorMessage(error)}
          </p>
        ) : isLoading ? (
          <div className="grid gap-2 border-t p-4 sm:px-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : organizations.length === 0 ? (
          <p className="border-t p-6 text-center text-sm text-muted-foreground">
            No organizations yet. They appear as customers&apos; payroll details are added.
          </p>
        ) : (
          <div className="border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>{label}</TableHead>
                  <TableHead>Waiting for a voucher</TableHead>
                  <TableHead>Latest locked</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((organization) => {
                  const state = monthState(organization, period, thisMonth);
                  return (
                    <TableRow
                      key={organization.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => onOpen(organization.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onOpen(organization.id);
                      }}
                    >
                      <TableCell className="min-w-40">
                        <p className="max-w-60 truncate font-medium">{organization.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {organization.customers} {organization.customers === 1 ? "customer" : "customers"} ·{" "}
                          {organization.runningLoans} running {organization.runningLoans === 1 ? "loan" : "loans"}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-44">
                        <span
                          className={cn(
                            "inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
                            toneClass[state.tone],
                          )}
                        >
                          {state.label}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">{state.note}</p>
                        {state.regenerate && <p className="mt-0.5 text-xs font-medium text-warning">Regenerate: an earlier month changed</p>}
                      </TableCell>
                      <TableCell className="min-w-40">
                        {organization.unlocked.length === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          <ul className="grid gap-0.5 text-xs">
                            {organization.unlocked.map((item) => (
                              <li key={item.variationId} className="whitespace-nowrap">
                                <span className="font-medium">{monthTitle(item.ym)}</span>{" "}
                                <span className="text-muted-foreground">v{item.version}</span>
                                {item.regenerateHint && <span className="text-warning"> · regenerate</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {organization.latestLocked ? (
                          monthTitle(organization.latestLocked.ym)
                        ) : (
                          <span className="text-xs text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Icon icon={icons.chevronRight} size={16} className="text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
