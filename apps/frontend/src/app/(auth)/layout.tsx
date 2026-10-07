import { Icon, icons } from "@/components/icon";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMosaic } from "@/ui/home/brand-mosaic";
import { headers } from "next/headers";

// Server-rendered so the side panel can speak to the page it sits beside (x-current-path is set in proxy.ts).
const panels: Record<string, { title: string; text: string }> = {
  "/sign-up": {
    title: "Borrow against your salary, repay without thinking about it.",
    text: "Create your account, add your work details and request cash or an item. Each month's repayment comes straight off your pay.",
  },
  "/login": {
    title: "Welcome back. Your loan is right where you left it.",
    text: "Check your balance, see your next deduction and request a top-up from your dashboard.",
  },
};

const fallback = {
  title: "Your account, kept safe.",
  text: "Codes to verify every change, passkeys and two-factor sign-in keep your loan and your details yours.",
};

const assurances = ["Repaid from your salary", "Rates shown before you confirm", "Track every naira in the app"];

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const panel = panels[headersList.get("x-current-path") ?? ""] ?? fallback;

  return (
    <main className="h-dvh max-h-dvh overflow-hidden bg-muted p-3 sm:p-4 lg:p-6">
      <div className="flex h-full min-h-0 gap-4 lg:gap-6">
        <aside className="relative isolate hidden min-h-0 flex-col justify-between overflow-hidden rounded-2xl bg-brand p-8 text-brand-foreground lg:flex lg:w-[48%] xl:w-1/2 xl:p-10">
          <BrandMosaic className="absolute inset-0 -z-10 h-full opacity-35" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand via-brand/85 to-brand/40" />

          <Logo className="h-8 w-auto text-brand-foreground" />

          <div aria-hidden className="mx-auto w-full max-w-sm rounded-2xl bg-background p-5 text-foreground shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Active Loan</p>
              <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">On track</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">₦350,000</p>
            <p className="text-xs text-muted-foreground">left to repay · 7 months</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[42%] rounded-full bg-primary" />
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl border p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success">
                <Icon icon={icons.checkCircle} size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold">Deduction received</p>
                <p className="truncate text-xs text-muted-foreground">₦50,000 for September · balance updated</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="max-w-lg text-balance text-2xl font-semibold leading-tight tracking-tight xl:text-3xl">
              {panel.title}
            </h2>
            <p className="mt-3 max-w-lg leading-7 text-brand-foreground/85">{panel.text}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {assurances.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-1.5 rounded-full border border-brand-foreground/25 bg-brand-foreground/10 px-3 py-1 text-xs font-medium"
                >
                  <Icon icon={icons.check} size={12} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <section className="relative flex min-h-0 w-full flex-col thin-scroll overflow-y-auto rounded-lg border bg-background shadow-sm lg:w-[52%] xl:w-1/2">
          <div className="flex h-full min-h-0 flex-col px-4 py-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex shrink-0 items-center justify-between lg:hidden">
              <Logo className="h-7 w-auto text-brand" />
              <ThemeToggle />
            </div>
            <div className="absolute right-8 top-8 hidden lg:block">
              <ThemeToggle />
            </div>
            <div className="flex min-h-0 flex-1">
              <div className="m-auto w-full max-w-[520px] py-4">{children}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
