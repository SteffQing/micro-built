import { Icon, icons, type IconData } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";
import { RepaymentEstimator } from "./estimator";

const products: { icon: IconData; title: string; text: string; points: string[] }[] = [
  {
    icon: icons.wallet,
    title: "Cash loans",
    text: "Money for what life throws at you, paid into your bank account.",
    points: ["Rent and school fees", "Medical bills and emergencies", "Business, travel and more"],
  },
  {
    icon: icons.creditCard,
    title: "Asset financing",
    text: "Get the item you need now from our catalogue and spread its cost over the months ahead.",
    points: ["Choose from listed items", "Fixed monthly deductions", "Same rates you see upfront"],
  },
  {
    icon: icons.trendingUp,
    title: "Top-ups",
    text: "Need a little more? Add to your running loan without starting a new application.",
    points: ["Cash or an item", "Folded into one deduction", "Request it from your dashboard"],
  },
];

const steps = [
  {
    title: "Create your account",
    text: "Sign up with your email or phone number. It takes a couple of minutes.",
  },
  {
    title: "Add your work details",
    text: "Tell us where you work, your payroll details and the bank account you want paid into.",
  },
  {
    title: "Request your loan",
    text: "Pick cash or an item. You see the interest and fees before you confirm anything.",
  },
  {
    title: "Get paid, repay automatically",
    text: "Once approved, the money goes to your bank. Each month's deduction comes off your salary.",
  },
];

const tracking: { icon: IconData; title: string; text: string }[] = [
  {
    icon: icons.dashboard,
    title: "Your balance, live",
    text: "What you owe, what you've repaid and what's left, updated as each deduction lands.",
  },
  {
    icon: icons.calendarClock,
    title: "No surprise deductions",
    text: "See next month's deduction and the last one received, side by side.",
  },
  {
    icon: icons.file,
    title: "Statements on demand",
    text: "Generate your loan statement any time; we email it to you when it's ready.",
  },
  {
    icon: icons.notifications,
    title: "Updates as they happen",
    text: "Get notified when your request is reviewed, your money is sent and repayments arrive.",
  },
];

const security: { icon: IconData; title: string; text: string }[] = [
  {
    icon: icons.fingerprint,
    title: "Passkey sign-in",
    text: "Sign in with your fingerprint or face, with no password to steal.",
  },
  {
    icon: icons.shield,
    title: "Two-factor authentication",
    text: "Add an authenticator app or codes to your email or phone.",
  },
  {
    icon: icons.monitor,
    title: "You control your sessions",
    text: "See every device signed in to your account and sign the others out.",
  },
  {
    icon: icons.lock,
    title: "Verified changes only",
    text: "Changing your email or phone number needs a code sent to the new one.",
  },
];

function SectionHeading({ eyebrow, title, text, center }: { eyebrow: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-pretty text-lg leading-8 text-muted-foreground">{text}</p>}
    </div>
  );
}

export function ProductsSection() {
  return (
    <section id="loans" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Loans"
          title="Credit that fits real life"
          text="Whether it's this term's school fees or a new fridge, borrow what you need and pay it back from your salary in equal monthly amounts."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {products.map((product) => (
            <article key={product.title} className="flex flex-col rounded-2xl border bg-card p-6 sm:p-8">
              <IconTile icon={product.icon} />
              <h3 className="mt-6 text-xl font-semibold">{product.title}</h3>
              <p className="mt-2 leading-7 text-muted-foreground">{product.text}</p>
              <ul className="mt-6 space-y-2.5 border-t pt-6 text-sm">
                {product.points.map((point) => (
                  <li key={point} className="flex items-center gap-2.5">
                    <Icon icon={icons.check} size={16} className="shrink-0 text-success" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EstimatorSection() {
  return (
    <section id="estimate" className="scroll-mt-20 border-y bg-secondary/60 py-20 dark:bg-card sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          center
          eyebrow="Know before you borrow"
          title="See your monthly deduction"
          text="Move the slider and pick a tenure. The numbers use our current rates, the same ones you'll see when you apply."
        />
        <div className="mx-auto mt-12 max-w-5xl">
          <RepaymentEstimator />
        </div>
      </div>
    </section>
  );
}

export function StepsSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="How it works" title="From sign-up to salary deduction in four steps" />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="relative rounded-2xl border bg-card p-6">
              <span className="btn-gradient flex size-10 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function TrackingSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="relative order-last lg:order-first">
          <div aria-hidden className="rounded-3xl border bg-muted/50 p-6 sm:p-10">
            <div className="rounded-2xl border bg-background p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Repayment progress</p>
                <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">On track</span>
              </div>
              <p className="mt-4 text-3xl font-semibold tabular-nums">₦350,000</p>
              <p className="text-sm text-muted-foreground">left to repay · 7 months</p>
              <div className="mt-5 grid grid-cols-12 gap-1">
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} className={i < 5 ? "h-8 rounded-sm bg-primary" : "h-8 rounded-sm bg-muted"} />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Aug 2026</span>
                <span>Jul 2027</span>
              </div>
            </div>
            <div className="ml-auto mt-4 w-4/5 rounded-2xl border bg-background p-4 shadow-lg">
              <div className="flex items-center gap-3">
                <IconTile icon={icons.file} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Your statement is ready</p>
                  <p className="truncate text-xs text-muted-foreground">We&apos;ve emailed you a download link</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <SectionHeading
            eyebrow="Your loan, in plain sight"
            title="Always know where you stand"
            text="Your dashboard shows every naira: what you borrowed, what's been deducted and what's next. No calls, no guesswork."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {tracking.map((item) => (
              <div key={item.title}>
                <IconTile icon={item.icon} size="sm" />
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SecuritySection() {
  return (
    <section
      id="security"
      className="scroll-mt-20 bg-foreground py-20 text-background dark:bg-card dark:text-foreground sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold text-chart-1">Security</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Your account is locked down by default
          </h2>
          <p className="mt-4 text-lg leading-8 text-background/75 dark:text-muted-foreground">
            We use the same sign-in protections as modern banks, and we will never ask for your password or codes over
            the phone.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {security.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-background/15 bg-background/5 p-6 dark:border-border dark:bg-background"
            >
              <Icon icon={item.icon} size={22} className="text-chart-1" />
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-background/75 dark:text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
