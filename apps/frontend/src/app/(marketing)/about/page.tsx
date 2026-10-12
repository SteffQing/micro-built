import type { Metadata } from "next";
import Link from "next/link";
import { Icon, icons, type IconData } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";
import { Button } from "@/components/ui/button";
import { openGraph } from "@/lib/seo";
import { SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_HREF } from "@/lib/support";
import { ClosingCta, SiteFooter } from "@/ui/home/closing";
import { PageHeader } from "@/ui/marketing/page-header";

const title = "About us · MicroBuilt Prime";
const description =
  "MicroBuilt Prime gives salary-backed loans to salary earners in Nigeria, repaid through a fixed monthly deduction from their pay.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/about" },
  openGraph: openGraph({ title, description, path: "/about" }),
};

const offer: { icon: IconData; title: string; text: string }[] = [
  {
    icon: icons.wallet,
    title: "Cash loans",
    text: "Money paid into your bank account, for school fees, rent, medical bills, business and more.",
  },
  {
    icon: icons.creditCard,
    title: "Asset financing",
    text: "An item from our catalogue now, with its cost spread over the months ahead.",
  },
  {
    icon: icons.trendingUp,
    title: "Top-ups",
    text: "More on top of a running loan, folded into one monthly deduction.",
  },
];

const cycle = [
  {
    title: "We send payroll the month's deduction",
    text: "Each month we give your employer's payroll a list of what to deduct from each borrower's salary.",
  },
  {
    title: "Payroll deducts it from your salary",
    text: "The fixed amount comes off your pay, and payroll sends back a record of what was actually deducted.",
  },
  {
    title: "Your dashboard updates",
    text: "When that record arrives, the month shows as paid, part-paid or missed, and your balance moves with it.",
  },
];

const promises: { icon: IconData; title: string; text: string }[] = [
  {
    icon: icons.percent,
    title: "Costs before you commit",
    text: "Interest and fees are shown before you confirm a request, and a running loan keeps the rates it was approved with.",
  },
  {
    icon: icons.userGroup,
    title: "People review every request",
    text: "Our team looks at each loan, top-up and change of details, and tells you in the app as things move.",
  },
  {
    icon: icons.dashboard,
    title: "Your loan in plain sight",
    text: "What you borrowed, what's been deducted and what's left, with a statement whenever you want one.",
  },
  {
    icon: icons.shield,
    title: "Security by default",
    text: "Passkeys, two-factor sign-in and verified changes, and we never ask for your password or codes.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <PageHeader
          seed="about-page"
          eyebrow="About us"
          title="Credit for salary earners, built around payday"
          lead="MicroBuilt Prime gives salary-backed loans to salary earners in Nigeria, mostly public servants. You apply in the app and repay through a fixed monthly deduction from your salary, so there is nothing to remember to pay."
        />

        <section aria-labelledby="offer-title" className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 id="offer-title" className="text-balance text-3xl font-semibold tracking-tight">
                What we offer
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Borrowing that fits the rhythm of a salary: an amount whose monthly cost you can see before you apply,
                repaid in equal deductions until it is cleared.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {offer.map((item) => (
                <article key={item.title} className="rounded-2xl border bg-card p-6">
                  <IconTile icon={item.icon} />
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 leading-7 text-muted-foreground">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="cycle-title" className="border-y bg-secondary/60 py-16 dark:bg-card sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 id="cycle-title" className="text-balance text-3xl font-semibold tracking-tight">
                How repayment works
              </h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                We work with your employer&apos;s payroll, so repayment happens on payday without you lifting a finger.
              </p>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {cycle.map((step, index) => (
                <li key={step.title} className="rounded-2xl border bg-background p-6">
                  <span className="btn-gradient flex size-10 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-2xl text-sm leading-6 text-muted-foreground">
              If a month comes up short, for example when salary is delayed, the gap stays on your balance and you can
              pay it yourself from the app.{" "}
              <Link href="/faq#short-deduction" className="font-medium text-primary underline-offset-4 hover:underline">
                What happens when a deduction falls short
              </Link>
            </p>
          </div>
        </section>

        <section aria-labelledby="promises-title" className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="promises-title" className="max-w-2xl text-balance text-3xl font-semibold tracking-tight">
              What you can count on
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {promises.map((item) => (
                <div key={item.title}>
                  <IconTile icon={item.icon} size="sm" />
                  <h3 className="mt-3 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="contact-title" className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-2xl border bg-card p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 id="contact-title" className="text-lg font-semibold">
                Talk to us
              </h2>
              <p className="mt-1 text-muted-foreground">
                Ask our assistant any time, or email{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                . The team is in {SUPPORT_HOURS}.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={SUPPORT_HREF}>
                  <Icon icon={icons.message} size={18} />
                  Help &amp; support
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/faq">Read the FAQ</Link>
              </Button>
            </div>
          </div>
        </section>

        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
