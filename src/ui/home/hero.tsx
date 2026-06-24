import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const metrics = [
  { label: "Open requests", value: "128", trend: "+14%" },
  { label: "Repayment rate", value: "92.4%", trend: "+3.8%" },
  { label: "Portfolio value", value: "₦84.2m", trend: "+21%" },
];

const pipeline = [
  { label: "Submitted", value: "42", width: "82%" },
  { label: "In review", value: "18", width: "54%" },
  { label: "Approved", value: "31", width: "74%" },
  { label: "Disbursed", value: "24", width: "62%" },
];

export default function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-background">
      <div className="absolute inset-x-0 top-0 h-[78%] bg-[radial-gradient(circle_at_top_left,oklch(0.96_0.03_145),transparent_34%),linear-gradient(180deg,oklch(0.99_0_0),oklch(0.965_0_0))] dark:bg-[radial-gradient(circle_at_top_left,oklch(0.22_0.04_145),transparent_34%),linear-gradient(180deg,oklch(0.10_0_0),oklch(0.075_0_0))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-border" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col px-4 pt-14 sm:px-6 lg:px-8 lg:pt-18">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Enterprise loan operations for regulated teams
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-normal text-foreground sm:text-5xl lg:text-6xl">
            MicroBuilt Loan Operations Platform
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Centralize customer onboarding, loan approvals, repayment tracking,
            and portfolio reporting in one secure workspace built for lending
            teams.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/sign-up">
                Request access
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/login">Sign in to workspace</Link>
            </Button>
          </div>
        </div>

        <div className="relative mt-12 flex flex-1 items-end pb-8 lg:mt-14">
          <div className="relative mx-auto w-full max-w-6xl">
            <div className="absolute -inset-x-10 bottom-0 h-32 rounded-[100%] bg-primary/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-lg border bg-background shadow-2xl">
              <div className="flex h-10 items-center justify-between border-b bg-muted/55 px-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-chart-1/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <p className="hidden text-xs font-medium text-muted-foreground sm:block">
                  microbuilt.app / portfolio-command
                </p>
                <div className="h-5 w-16 rounded border bg-background" />
              </div>

              <div className="grid min-h-[420px] bg-background lg:grid-cols-[260px_1fr]">
                <aside className="hidden border-r bg-muted/35 p-4 lg:block">
                  <div className="mb-6 h-8 w-32 rounded-md bg-foreground/90" />
                  <nav className="space-y-2">
                    {["Overview", "Customers", "Loan requests", "Repayments", "Reports"].map(
                      (item, index) => (
                        <div
                          key={item}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                            index === 0
                              ? "bg-background text-foreground shadow-xs"
                              : "text-muted-foreground"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full bg-primary/70" />
                          {item}
                        </div>
                      ),
                    )}
                  </nav>
                </aside>

                <div className="min-w-0 p-4 sm:p-5 lg:p-6">
                  <div className="mb-5 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Command center
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-normal">
                        Portfolio overview
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      Updated 2 minutes ago
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {metrics.map((metric) => (
                      <div key={metric.label} className="rounded-md border bg-background p-4">
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <p className="text-2xl font-semibold tracking-normal">
                            {metric.value}
                          </p>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            {metric.trend}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
                    <div className="rounded-md border bg-background p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Loan pipeline</p>
                          <p className="text-xs text-muted-foreground">
                            Status by operations queue
                          </p>
                        </div>
                        <TrendingUp className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-4">
                        {pipeline.map((item) => (
                          <div key={item.label}>
                            <div className="mb-1.5 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-medium">{item.value}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: item.width }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-md border bg-muted/25 p-3">
                      <Image
                        src="/loan_application.png"
                        alt="MicroBuilt loan application workflow"
                        width={1000}
                        height={1406}
                        className="mx-auto h-[245px] w-auto rounded-md border bg-background object-cover object-top shadow-xl"
                        priority
                      />
                      <div className="absolute bottom-3 left-3 right-3 rounded-md border bg-background/92 p-3 shadow-lg backdrop-blur">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium">Loan request ready</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Structured applications move from request to approval
                          without spreadsheet handoffs.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-5 grid max-w-4xl grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              {[
                "Customer records and loan history",
                "Approval queues and repayment monitoring",
                "Admin reporting and account-officer oversight",
              ].map((item) => (
                <div key={item} className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
