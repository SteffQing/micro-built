import { Icon, icons } from "@/components/icon";
import { SessionCta } from "@/components/session-cta";
import { DashboardPreview } from "./dashboard-preview";

const assurances = ["Repaid from your salary", "Rates shown before you confirm", "Track every naira in the app"];

export default function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_85%_10%,color-mix(in_oklab,var(--brand)_14%,transparent),transparent_70%),radial-gradient(ellipse_60%_50%_at_0%_100%,color-mix(in_oklab,var(--chart-1)_16%,transparent),transparent_70%)]"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1fr_1.1fr] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="max-w-xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />
            Salary-backed loans for working Nigerians
          </p>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Loans that work <span className="text-primary">around your payday.</span>
          </h1>
          <p className="mt-6 text-pretty text-lg leading-8 text-muted-foreground">
            Borrow cash or finance the things you need, then repay in fixed monthly amounts taken straight from your
            salary. No due dates to chase, and your balance is always one tap away.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SessionCta signInLabel="Sign in" />
          </div>
          <ul className="mt-8 grid gap-2.5 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-4">
            {assurances.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Icon icon={icons.checkCircle} size={16} className="mt-0.5 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <DashboardPreview />
          <div
            aria-hidden
            className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-xl border bg-background/95 py-2.5 pl-2.5 pr-4 shadow-xl backdrop-blur sm:-left-6 sm:bottom-10"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-success/12 text-success">
              <Icon icon={icons.checkCircle} size={18} />
            </span>
            <div>
              <p className="text-xs font-semibold">Deduction received</p>
              <p className="text-xs text-muted-foreground">₦50,000 · balance updated</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
