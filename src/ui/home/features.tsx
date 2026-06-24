import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const workflow = [
  {
    icon: UsersRound,
    title: "Onboard customers cleanly",
    text: "Capture identity, payroll, payment, and account-officer details in one structured profile.",
  },
  {
    icon: ClipboardCheck,
    title: "Review every loan request",
    text: "Route cash and commodity requests through clear approval, rejection, and disbursement states.",
  },
  {
    icon: RefreshCw,
    title: "Track repayment outcomes",
    text: "Monitor scheduled repayments, failed deductions, liquidation requests, and manual resolutions.",
  },
  {
    icon: BarChart3,
    title: "Report portfolio movement",
    text: "Give leadership fast visibility into outstanding balance, repaid amount, revenue, and risk signals.",
  },
];

const controls = [
  {
    icon: ShieldCheck,
    title: "Role-aware operations",
    text: "Separate customer, account-officer, admin, and super-admin workflows without duplicating screens.",
  },
  {
    icon: Database,
    title: "Single customer record",
    text: "Keep applications, loans, repayments, messages, and generated reports tied to one profile.",
  },
  {
    icon: FileSpreadsheet,
    title: "Bulk workflows",
    text: "Support operational realities like customer uploads and repayment file processing.",
  },
  {
    icon: BellRing,
    title: "Action visibility",
    text: "Surface pending approvals, repayment issues, notifications, and operational queues where teams work.",
  },
  {
    icon: WalletCards,
    title: "Cash and commodity lending",
    text: "Manage different loan products from the same command surface with product-specific actions.",
  },
  {
    icon: MessageSquareText,
    title: "Customer communication",
    text: "Coordinate status updates, reports, and account actions without losing context.",
  },
];

export default function FeaturesSection() {
  return (
    <div className="bg-background">
      <section id="platform" className="border-y bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-primary">
                Built for loan teams
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-normal sm:text-4xl">
                Replace scattered lending work with one operating rhythm.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                MicroBuilt gives administrators and account officers a shared
                system for customer records, approvals, repayment follow-up,
                and portfolio reporting.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {workflow.map((item) => (
                <section key={item.title} className="rounded-lg border bg-background p-5 shadow-xs">
                  <item.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-4 text-base font-semibold tracking-normal">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.text}
                  </p>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="controls" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="relative overflow-hidden rounded-lg border bg-muted/25 p-3">
              <Image
                src="/login_illistration.jpg"
                alt="Team member working in a secure lending workspace"
                width={2054}
                height={1369}
                className="h-[420px] w-full rounded-md object-cover"
              />
              <div className="absolute bottom-6 left-6 right-6 rounded-lg border bg-background/92 p-4 shadow-xl backdrop-blur">
                <div className="flex flex-wrap gap-2">
                  {["Customers", "Approvals", "Repayments", "Reports"].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Every queue, record, and exception stays attached to the
                  operational workflow instead of disappearing into chats and
                  spreadsheets.
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-primary">
                Enterprise controls
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
                Quiet tooling for high-stakes lending operations.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                The interface is intentionally practical: dense enough for daily
                operations, clear enough for managers, and structured enough for
                growing lending teams.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {controls.map((item) => (
                  <section key={item.title} className="rounded-lg border bg-background p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md border bg-muted p-2">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="border-y bg-foreground py-16 text-background dark:bg-card dark:text-foreground sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8 lg:items-center">
          <div>
            <div className="mb-5 flex w-fit items-center gap-2 rounded-full border border-background/20 px-3 py-1 text-xs font-medium text-background/70 dark:text-muted-foreground">
              <LockKeyhole className="h-3.5 w-3.5" />
              Designed for controlled access
            </div>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-normal sm:text-4xl">
              Give every lending role the workspace it needs.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-background/70 dark:text-muted-foreground">
              Customers request loans. Account officers manage relationships.
              Admin teams review, approve, disburse, and report. MicroBuilt
              keeps those workflows connected.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              "Admin dashboards for portfolio health",
              "Customer profiles with loan and repayment history",
              "Operational queues for pending requests and exceptions",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border border-background/15 bg-background/5 p-4 text-sm text-background/85 dark:border-border dark:bg-background dark:text-foreground"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-primary">
            Ready for the next loan cycle?
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
            Move lending operations into one reliable workspace.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Start with the workflows your team already runs every day:
            onboarding, approvals, repayments, and reporting.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Request access
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
