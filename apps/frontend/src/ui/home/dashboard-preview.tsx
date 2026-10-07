import { Icon, icons, type IconData } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

/*
 * The customer dashboard, drawn in HTML rather than shipped as a screenshot: it stays sharp at any size, follows the
 * theme, and leaves the hero's headline (not an image) as the page's largest paint. It mirrors the real customer
 * dashboard (src/ui/dashboard/user-dashboard): active loan, repayment rate, pending requests, deductions, activity.
 */

const menu: [string, IconData][] = [
  ["Dashboard", icons.dashboard],
  ["Loan Request", icons.loans],
  ["Repayments", icons.repayments],
  ["Statement", icons.file],
  ["Notifications", icons.notifications],
  ["Settings", icons.settings],
];

const activity = [
  { date: "26 Sep 2026", title: "Repayment received", detail: "₦50,000 for September" },
  { date: "27 Aug 2026", title: "Repayment received", detail: "₦50,000 for August" },
  { date: "14 Jul 2026", title: "Loan disbursed", detail: "₦600,000 paid to your bank" },
];

export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none select-none overflow-hidden rounded-2xl border bg-background text-left shadow-2xl ring-1 ring-foreground/5",
        className,
      )}
    >
      <div className="grid md:grid-cols-[176px_1fr]">
        <div className="hidden border-r bg-sidebar p-3 md:block">
          <Logo className="mb-5 ml-1 h-6 w-auto text-brand" />
          <div className="space-y-0.5">
            {menu.map(([label, icon], index) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px]",
                  index === 0 ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon icon={icon} size={14} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 bg-muted/40 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Good morning, Tolu</p>
              <p className="text-sm font-semibold">Dashboard</p>
            </div>
            <span className="btn-gradient flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground">
              <Icon icon={icons.plus} size={12} />
              Request loan
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="col-span-2 rounded-xl border bg-background p-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium">Active Loan</p>
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                  <span className="size-1 rounded-full bg-primary" />
                  Active
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold tabular-nums">₦600,000</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-success/10">
                <div className="h-full w-[42%] rounded-full bg-primary" />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px]">
                <span>
                  <span className="text-muted-foreground">Repaid: </span>
                  <span className="font-semibold text-primary">₦250,000</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Balance: </span>
                  <span className="font-semibold text-primary">₦350,000</span>
                </span>
              </div>
            </div>
            <Stat icon={icons.percent} label="Repayment Rate" value="100%" />
            <Stat icon={icons.alert} tone="warning" label="Pending Requests" value="0" />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border [&>*]:bg-background">
            <Deduction icon={icons.calendarClock} tone="warning" label="Next deduction" value="₦50,000" detail="For October 2026" />
            <Deduction icon={icons.checkCircle} tone="success" label="Last deduction" value="₦50,000" detail="September 2026 · paid 26 Sep" />
          </div>

          <div className="mt-2 hidden rounded-xl border bg-background sm:block">
            <p className="border-b px-3 py-2 text-[12px] font-medium">Recent activity</p>
            {activity.map((row) => (
              <div key={row.date} className="grid grid-cols-[96px_1fr_auto] gap-2 border-b px-3 py-2 text-[11px] last:border-0">
                <span className="text-muted-foreground">{row.date}</span>
                <span className="font-medium">{row.title}</span>
                <span className="font-medium text-success">{row.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, tone, label, value }: { icon: IconData; tone?: "warning"; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
      <IconTile icon={icon} tone={tone} size="sm" />
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Deduction({
  icon,
  tone,
  label,
  value,
  detail,
}: {
  icon: IconData;
  tone: "warning" | "success";
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 p-3">
      <div className="flex items-center gap-2">
        <IconTile icon={icon} tone={tone} size="sm" />
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-base font-semibold tabular-nums">{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}
