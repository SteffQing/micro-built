"use client";

import { useQuery } from "@tanstack/react-query";
import { defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { chartHostStyle, chartTheme, formatPercent } from "@/components/charts/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supportAnalytics } from "@/lib/queries/support";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A Lagos day (UTC+1, no daylight saving), `days` before today. */
const lagosDay = (daysAgo = 0) => new Date(Date.now() + 60 * 60 * 1000 - daysAgo * DAY_MS).toISOString().slice(0, 10);
const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days" } as const;

const dayLabel = (day: string) => format(parseISO(day), "d MMM");

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 p-4 shadow-none">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/** Super admins: how the assistant is used and holding up (backend GET /admin/support/analytics). */
export function SupportAnalyticsView() {
  const [range, setRange] = useState<keyof typeof RANGES>("30");
  const from = lagosDay(Number(range) - 1);
  const to = lagosDay();
  const { data, isLoading, error } = useQuery(supportAnalytics(from, to));

  const totals = useMemo(() => {
    const rows = data?.perDay ?? [];
    return {
      conversations: rows.reduce((sum, row) => sum + row.conversations, 0),
      messages: rows.reduce((sum, row) => sum + row.messages, 0),
    };
  }, [data]);

  const definition = useMemo(
    () =>
      defineChart(
        {
          marks: [
            lineY(data?.perDay ?? [], { x: "day", y: "conversations", stroke: "var(--chart-2)", strokeWidth: 2 }),
            lineY(data?.perDay ?? [], { x: "day", y: "handoffs", stroke: "var(--chart-4)", strokeWidth: 2 }),
          ],
          scales: {
            x: {
              scale: () => scalePoint<string>().padding(0.2),
              axis: { line: false, ticks: { format: dayLabel }, tickLabels: { thin: true } },
            },
            y: { scale: scaleLinear, nice: true, grid: true, axis: { line: false, ticks: { count: 4 } } },
          },
          theme: chartTheme,
        },
        {
          tooltip: {
            use: tooltip,
            content: (points) => {
              const datum = points[0]?.datum;
              if (!datum) return { rows: [] };
              return {
                title: dayLabel(datum.day),
                rows: [
                  { label: "Conversations", value: String(datum.conversations), active: true },
                  { label: "Messages", value: String(datum.messages) },
                  { label: "Passed to the team", value: String(datum.handoffs) },
                ],
              };
            },
          },
        }
      ),
    [data]
  );

  const ratings = data ? data.ratings.up + data.ratings.down : 0;

  return (
    <div className="grid gap-3 lg:gap-5">
      <div className="flex justify-end">
        <Select value={range} onValueChange={(value) => setRange(value as keyof typeof RANGES)}>
          <SelectTrigger className="w-44" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RANGES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : error || !data ? (
        <p role="alert" className="py-10 text-center text-sm text-destructive">
          Couldn&apos;t load the analytics.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Conversations" value={totals.conversations.toLocaleString("en")} hint={`${totals.messages.toLocaleString("en")} messages`} />
            <Tile label="Passed to the team" value={formatPercent(data.handoffRate)} hint="of conversations" />
            <Tile
              label="Helpful replies"
              value={ratings ? formatPercent(data.ratings.up / ratings) : "—"}
              hint={`👍 ${data.ratings.up} · 👎 ${data.ratings.down}`}
            />
            <Tile label="Busy replies" value={data.canned.busy.toLocaleString("en")} hint="every model was out of quota" />
          </div>

          <Card className="rounded-xl shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Per day</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="mb-2 flex flex-wrap gap-4 px-2 text-xs text-muted-foreground sm:px-0">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="inline-block h-0.5 w-5 rounded bg-chart-2" /> Conversations
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden className="inline-block h-0.5 w-5 rounded bg-chart-4" /> Passed to the team
                </span>
              </div>
              <Chart
                definition={definition}
                height={260}
                ariaLabel={`Support conversations per day from ${dayLabel(from)} to ${dayLabel(to)}: ${totals.conversations} in all.`}
                ariaDescription="Hover or focus a day to see its conversations, messages and handoffs."
                style={chartHostStyle}
              />
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
            <Card className="gap-0 overflow-hidden p-0 shadow-none">
              <CardHeader className="p-4">
                <CardTitle className="text-base">Replies by model</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Replies</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byProvider.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        No replies from a model in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.byProvider.map((row) => (
                      <TableRow key={`${row.provider}:${row.model}`}>
                        <TableCell className="capitalize">{row.provider}</TableCell>
                        <TableCell className="font-mono text-xs break-all">{row.model}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.replies.toLocaleString("en")}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="text-muted-foreground">
                    <TableCell colSpan={2}>Fixed replies (refused, off topic, eligibility, busy)</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {data.canned.refusal} · {data.canned.offTopic} · {data.canned.eligibility} · {data.canned.busy}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
            <Card className="gap-0 overflow-hidden p-0 shadow-none">
              <CardHeader className="p-4">
                <CardTitle className="text-base">Quota hits</CardTitle>
                <p className="text-sm text-muted-foreground">Times a provider answered “too many requests”.</p>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Hits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.quotaHits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                        None in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.quotaHits.map((row) => (
                      <TableRow key={row.provider}>
                        <TableCell className="capitalize">{row.provider}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.count.toLocaleString("en")}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
