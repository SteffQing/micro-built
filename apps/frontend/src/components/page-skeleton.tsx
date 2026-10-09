import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Placeholders shaped like the page about to load, instead of a spinner. They fade in after a beat (see
 * `.skeleton-reveal`), so a fast load shows nothing at all rather than a flash.
 *
 * - dashboard: stat cards, a chart and a side rail
 * - table: a list page with filters and rows
 * - detail: one record (a customer, an organization) with a header, tabs and cards
 * - form: settings, a loan request
 * - list: a feed (notifications)
 */
export type PageSkeletonVariant = "dashboard" | "table" | "detail" | "form" | "list";

// Fixed widths, not random ones: the server and the browser render the same thing.
const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/12", "w-7/12", "w-1/3"];
const widthAt = (i: number) => WIDTHS[i % WIDTHS.length];

export function PageSkeleton({ variant = "table", className }: { variant?: PageSkeletonVariant; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("skeleton-reveal @container/main flex w-full flex-col gap-4 px-4 py-4 md:gap-6 md:py-6", className)}
    >
      <span className="sr-only">Loading…</span>
      {variant === "dashboard" && <DashboardShape />}
      {variant === "table" && <TableShape />}
      {variant === "detail" && <DetailShape />}
      {variant === "form" && <FormShape />}
      {variant === "list" && <ListShape />}
    </div>
  );
}

function TitleRow({ action = true }: { action?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-44 sm:w-56" />
        <Skeleton className="h-4 w-64 max-w-[70vw] sm:w-80" />
      </div>
      {action && <Skeleton className="hidden h-9 w-32 rounded-lg sm:block" />}
    </div>
  );
}

function StatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid min-w-0 gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-20 min-w-0" />
            <Skeleton className="size-8 shrink-0 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-28 max-w-full" />
          <Skeleton className="h-3 w-16 max-w-full" />
        </div>
      ))}
    </div>
  );
}

/** A table: a header strip and rows whose cells vary in width, as real data does. */
export function TableSkeleton({ rows = 8, columns = 5, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        {Array.from({ length: columns }, (_, c) => (
          <div key={c} className={cn(c === 0 ? "flex-[2]" : "flex-1", c > 2 && "hidden @2xl/main:block")}>
            <Skeleton className={cn("h-3", c === 0 ? "w-24" : "w-16")} />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
          <div className="flex flex-[2] items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className={cn("h-3.5", widthAt(r))} />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          {Array.from({ length: columns - 1 }, (_, c) => (
            <div key={c} className={cn("flex-1", c > 1 && "hidden @2xl/main:block")}>
              <Skeleton className={cn("h-3.5", widthAt(r + c + 1))} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FilterBar() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 w-full max-w-72 rounded-lg" />
      <Skeleton className="h-9 w-24 rounded-lg" />
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
  );
}

function TableShape() {
  return (
    <>
      <TitleRow />
      <FilterBar />
      <TableSkeleton />
    </>
  );
}

function DashboardShape() {
  return (
    <>
      <TitleRow action={false} />
      <StatCards />
      <div className="grid gap-4 @4xl/main:grid-cols-[1fr_20rem]">
        <div className="grid gap-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          {/* Bars of a chart, rising and falling. */}
          <div className="flex h-56 items-end gap-2">
            {[45, 70, 55, 85, 60, 75, 50, 90, 65, 80, 58, 72].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="grid content-start gap-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className={cn("h-3.5", widthAt(i))} />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DetailShape() {
  return (
    <>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <StatCards />
      {/* Tabs: clipped, not wider than a phone (they add up to 344 px). */}
      <div className="flex gap-2 overflow-hidden border-b pb-2">
        {[20, 24, 16, 20].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-lg" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <TableSkeleton rows={5} />
    </>
  );
}

function FormShape() {
  return (
    <>
      <TitleRow action={false} />
      <div className="grid gap-4 @3xl/main:grid-cols-[14rem_1fr]">
        {/* The tabs share the width on a phone (four fixed-width ones ran past its edge), a column beside the form above. */}
        <div className="grid grid-cols-4 gap-2 @3xl/main:grid-cols-1 @3xl/main:content-start">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="grid gap-5 rounded-xl border bg-card p-4 sm:p-6">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-32 justify-self-end rounded-lg" />
        </div>
      </div>
    </>
  );
}

/** A feed of items, each an icon and two lines. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start gap-3 p-4">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className={cn("h-4", widthAt(i))} />
            <Skeleton className={cn("h-3", widthAt(i + 3))} />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function ListShape() {
  return (
    <>
      <TitleRow />
      <ListSkeleton />
    </>
  );
}

/** Label and value rows, for a dialog or sheet waiting on one record. */
export function DetailRowsSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("skeleton-reveal grid gap-4", className)}>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <Skeleton className={cn("h-3.5", i % 2 ? "w-20" : "w-28")} />
          <Skeleton className={cn("h-4", i % 3 === 0 ? "w-36" : i % 3 === 1 ? "w-24" : "w-32")} />
        </div>
      ))}
    </div>
  );
}
